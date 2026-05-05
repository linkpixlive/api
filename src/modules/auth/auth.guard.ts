import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../common/decorators/isPublic';
import { UsersRepository } from '../../infra/db/repositories/users.repositories';
import { RedisService } from '../../infra/redis/redis.service';
import { SafeUser } from './entities/safe-user.entity';

export interface JwtPayload {
  sub: string;
  sid: string;
  roles: string[];
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
    private usersRepository: UsersRepository,
    private redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      const session = await this.redisService.get(
        `auth:session:${payload.sid}`,
      );

      if (!session) {
        throw new UnauthorizedException();
      }

      const user = await this.usersRepository.findById(payload.sub);

      if (!user) {
        throw new UnauthorizedException();
      }

      const safeUser = SafeUser.fromPrisma(user);

      request['user'] = safeUser;
      request['sid'] = payload.sid;
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

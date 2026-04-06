import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { SafeUser } from '../../modules/auth/entities/safe-user.entity';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): SafeUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request['user'] as SafeUser;
  },
);

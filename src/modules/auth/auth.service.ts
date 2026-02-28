import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { UsersRepository } from 'src/common/db/repositories/users.repositories';
import { SecurityService } from 'src/common/security/security.service';
import { LoginAuthDto } from './dto/login-auth.dto';
import { RegisterAuthDto } from './dto/register-auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersRepository: UsersRepository,
    private securityService: SecurityService,
    private jwtService: JwtService,
  ) {}

  async register(registerAuthDto: RegisterAuthDto) {
    const { name, username, email, password, cpf } = registerAuthDto;

    const hashedCpf = this.generateHash(cpf);

    const [emailExists, usernameExists, cpfExists] = await Promise.all([
      this.usersRepository.getBy({ email }),
      this.usersRepository.getBy({ username }),
      this.usersRepository.getBy({ cpf_hash: hashedCpf }),
    ]);

    if (emailExists) throw new ConflictException('Email already exists');
    if (usernameExists) throw new ConflictException('Username already exists');
    if (cpfExists) throw new ConflictException('CPF already exists');

    const encryptedCpf = this.securityService.encryptData(cpf);
    const encryptedPassword = await this.generatePasswordHash(password);

    const user = await this.usersRepository.create({
      data: {
        email,
        name,
        username,
        password: encryptedPassword,
        cpf_hash: hashedCpf,
        cpf: encryptedCpf,
        wallet: { create: {} },
      },
    });

    const token = await this.jwtService.signAsync({ sub: user.id });

    return token;
  }

  async login(loginAuthDto: LoginAuthDto) {
    const { email, password } = loginAuthDto;

    const user = await this.usersRepository.getBy({ email });
    if (!user) throw new UnauthorizedException('User not exists');

    const isPasswordValid = await this.comparePassword(password, user.password);

    if (!isPasswordValid)
      throw new UnauthorizedException('Invalid credentials');

    const token = await this.jwtService.signAsync({ sub: user.id });

    return token;
  }

  private async generatePasswordHash(password: string) {
    return await bcrypt.hash(password, 12);
  }

  private async comparePassword(password: string, hash: string) {
    return await bcrypt.compare(password, hash);
  }

  private generateHash(value: string) {
    return crypto
      .createHash('sha256')
      .update(value + process.env.ENCRYPTION_KEY)
      .digest('hex');
  }
}

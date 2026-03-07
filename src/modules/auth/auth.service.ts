import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { SecurityService } from 'src/common/security/security.service';
import { ChangePasswordRepository } from 'src/infra/db/repositories/change-password.repositorites';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { EmailService } from 'src/infra/queues/email/email.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersRepository: UsersRepository,
    private changePassRepository: ChangePasswordRepository,
    private securityService: SecurityService,
    private jwtService: JwtService,
    private emailService: EmailService,
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

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const responseMsg = `An email was sent to ${email} with a link to change your password.`;

    const user = await this.usersRepository.getBy({ email });
    if (!user) return responseMsg;

    await this.changePassRepository.deleteMany({
      where: { user_id: user.id },
    });

    const uuid = crypto.randomUUID();
    const hashedUUID = this.generateHash(uuid);

    const expeiresDate = new Date();
    expeiresDate.setMinutes(expeiresDate.getMinutes() + 2);

    await this.changePassRepository.create({
      data: { token: hashedUUID, expires_at: expeiresDate, user_id: user.id },
    });

    const sendEmail = await this.emailService.sendEmail({
      to: email,
      subject: 'Forgot Password',
      templateName: 'forgot-password',
      context: { link: `https://tipply.com.br/forgot-passowrd?token=${uuid}` },
      metadata: {},
    });

    return { responseMsg, sendEmail };
  }

  async resetPassword(resetPassword: ResetPasswordDto, token: string) {
    const { newPassword } = resetPassword;

    const hashedToken = this.generateHash(token);

    const updatePassword = await this.changePassRepository.getBy({
      token: hashedToken,
    });

    if (!updatePassword) throw new BadRequestException('invalid token');

    const nowDate = new Date();

    if (nowDate > updatePassword.expires_at) {
      throw new BadRequestException(
        'time has expired, start the process again',
      );
    }

    const hashedNewPassword = await this.generatePasswordHash(newPassword);

    await this.usersRepository.update({
      where: { id: updatePassword.user_id },
      data: { password: hashedNewPassword },
    });

    await this.changePassRepository.delete({ where: { token: hashedToken } });

    return 'password changed successfully';
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

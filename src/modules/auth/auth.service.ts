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
import { ChangePasswordRepository } from 'src/infra/db/repositories/change-password.repositories';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { EmailService } from 'src/infra/queues/email/email.service';
import { RedisService } from 'src/infra/redis/redis.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

interface OtpData {
  otp: string;
  attempts: number;
  createdAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private usersRepository: UsersRepository,
    private changePassRepository: ChangePasswordRepository,
    private securityService: SecurityService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private redisService: RedisService,
  ) {}

  async register(registerAuthDto: RegisterAuthDto) {
    const { name, username, email, password, cpf } = registerAuthDto;
    const hashedCpf = this.securityService.hashData(cpf);

    const [emailUser, usernameUser, cpfUser] = await Promise.all([
      this.usersRepository.findByEmail(email),
      this.usersRepository.findByUsername(username),
      this.usersRepository.findByCpfHash(hashedCpf),
    ]);

    if (usernameUser && usernameUser.email !== email) {
      throw new ConflictException('Username already in use');
    }

    if (cpfUser && cpfUser.email !== email) {
      throw new ConflictException('CPF already in use');
    }

    const encryptedCpf = this.securityService.encryptData(cpf);
    const encryptedPassword = await this.generatePasswordHash(password);

    const userData = {
      name,
      username,
      password: encryptedPassword,
      cpfHash: hashedCpf,
      cpf: encryptedCpf,
      email,
      verifiedEmail: false,
    };

    if (emailUser) {
      if (emailUser.verifiedEmail) {
        throw new ConflictException('Email already in use');
      }

      await this.usersRepository.update(emailUser.id, userData);
      await this.sendVerificationOtp(email);
      return 'This email is already pending verification. A new code has been sent to your email.';
    }

    await this.usersRepository.create(userData);

    await this.sendVerificationOtp(email);

    return 'Check your email and finish creating your account.';
  }

  async login(loginAuthDto: LoginAuthDto) {
    const { email, password } = loginAuthDto;

    const user = await this.usersRepository.findByEmail(email);

    if (!user || !user.active)
      throw new UnauthorizedException('User not exists.');

    const isPasswordValid = await this.comparePassword(password, user.password);

    if (!isPasswordValid)
      throw new UnauthorizedException('Invalid credentials.');

    if (!user.verifiedEmail) {
      await this.sendVerificationOtp(email);
      throw new UnauthorizedException('User not verified, check your email.');
    }

    const token = await this.jwtService.signAsync({
      sub: user.id,
      roles: user.roles,
    });

    return token;
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const responseMsg = `An email was sent to ${email} with a link to change your password.`;

    const user = await this.usersRepository.findByEmail(email);
    if (!user) return responseMsg;

    await this.changePassRepository.deleteManyByUserId(user.id);

    const uuid = crypto.randomUUID();
    const hashedUUID = this.securityService.hashData(uuid);

    const expeiresDate = new Date();
    expeiresDate.setMinutes(expeiresDate.getMinutes() + 2);

    await this.changePassRepository.create({
      token: hashedUUID,
      expiresAt: expeiresDate,
      userId: user.id,
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

  async resetPassword(resetPassword: ResetPasswordDto) {
    const { newPassword, token } = resetPassword;

    const hashedToken = this.securityService.hashData(token);

    const updatePassword =
      await this.changePassRepository.findByToken(hashedToken);

    if (!updatePassword) throw new BadRequestException('invalid token');

    const nowDate = new Date();

    if (nowDate > updatePassword.expires_at) {
      throw new BadRequestException(
        'time has expired, start the process again',
      );
    }

    const hashedNewPassword = await this.generatePasswordHash(newPassword);

    await this.usersRepository.update(updatePassword.user_id, {
      password: hashedNewPassword,
    });

    await this.changePassRepository.deleteByToken(hashedToken);

    return 'password changed successfully';
  }

  async verifyOtp({ otp, email }: VerifyOtpDto) {
    const redisKey = `otp:verification:${email}`;
    const otpData = await this.redisService.get<OtpData>(redisKey);
    const hashedOtp = this.securityService.hashData(otp);

    if (!otpData) {
      throw new BadRequestException('OTP expired or not found');
    }

    if (otpData.attempts >= 5) {
      await this.redisService.remove(redisKey);
      await this.sendVerificationOtp(email);
      throw new BadRequestException(
        'Too many attempts. A new code has been sent to your email.',
      );
    }

    if (otpData.otp !== hashedOtp) {
      const updated = await this.redisService.update(redisKey, {
        ...otpData,
        attempts: otpData.attempts + 1,
      });

      if (!updated) {
        throw new BadRequestException('OTP expired or not found');
      }

      throw new BadRequestException(`Invalid OTP`);
    }

    const user = await this.usersRepository.findByEmail(email);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const updatedUser = await this.usersRepository.update(user.id, {
      verifiedEmail: true,
    });

    await this.redisService.remove(redisKey);

    const token = await this.jwtService.signAsync({
      sub: updatedUser.id,
      roles: updatedUser.roles,
    });

    return token;
  }

  private async generatePasswordHash(password: string) {
    return await bcrypt.hash(password, 12);
  }

  private async comparePassword(password: string, hash: string) {
    return await bcrypt.compare(password, hash);
  }

  private async sendVerificationOtp(email: string) {
    const otp = crypto.randomInt(100000, 999999).toString();
    const redisKey = `otp:verification:${email}`;

    const hashedOtp = this.securityService.hashData(otp);

    const otpData = await this.redisService.get<OtpData>(redisKey);

    if (otpData) {
      const now = new Date();
      const createdDate = new Date(otpData.createdAt);

      const secondsPassed = Math.floor(
        (now.getTime() - createdDate.getTime()) / 1000,
      );
      const cooldownLimit = 60;

      if (secondsPassed < cooldownLimit) {
        const secondsLeft = cooldownLimit - secondsPassed;

        throw new BadRequestException(
          `Please wait ${secondsLeft} seconds to request a new code.`,
        );
      }
    }

    await this.redisService.setWithExpire(redisKey, 600, {
      otp: hashedOtp,
      attempts: 0,
      createdAt: new Date(),
    });

    await this.emailService.sendEmail({
      to: email,
      subject: 'Verify your email',
      templateName: 'verify-email',
      context: { otp },
      metadata: {},
    });
  }
}

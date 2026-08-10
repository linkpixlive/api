import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { verifySync } from 'otplib';
import { SecurityService } from 'src/common/security/security.service';
import { ChangePasswordRepository } from 'src/infra/db/repositories/change-password.repositories';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { EmailService } from 'src/infra/queues/email/email.service';
import { RedisService } from 'src/infra/redis/redis.service';
import { ProfileService } from '../profile/profile.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { Login2faDto } from './dto/login-2fa.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { VerificationService } from './verification.service';

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
    private configService: ConfigService,
    private profileService: ProfileService,
    private verificationService: VerificationService,
  ) {}

  async register(registerAuthDto: RegisterAuthDto) {
    const { name, username, email, password, cpf } = registerAuthDto;
    const hashedCpf = this.securityService.hashData(cpf);

    await this.profileService.validateUsernameAvailability(username);

    const [emailUser, usernameUser, cpfUser] = await Promise.all([
      this.usersRepository.findByEmail(email),
      this.usersRepository.findByUsername(username),
      this.usersRepository.findByCpfHash(hashedCpf),
    ]);

    if (usernameUser && usernameUser.email !== email) {
      throw new ConflictException('Nome de usuário já está em uso');
    }

    if (cpfUser && cpfUser.email !== email) {
      throw new ConflictException('CPF já está em uso');
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
        throw new ConflictException('Email já está em uso');
      }

      await this.usersRepository.update(emailUser.id, userData);
      await this.verificationService.sendVerificationOtp(email);
      return 'Este email já está pendente de verificação. Um novo código foi enviado para seu email.';
    }

    await this.usersRepository.create(userData);

    await this.verificationService.sendVerificationOtp(email);

    return 'Verifique seu email e finalize o cadastro.';
  }

  async login(loginAuthDto: LoginAuthDto) {
    const { email, password } = loginAuthDto;

    const user = await this.usersRepository.findByEmail(email);

    if (!user) throw new UnauthorizedException('Usuário não existe.');

    const isPasswordValid = await this.comparePassword(password, user.password);

    if (!isPasswordValid)
      throw new UnauthorizedException('Credenciais inválidas.');

    if (!user.active) {
      await this.usersRepository.update(user.id, { active: true });
    }

    if (!user.verifiedEmail) {
      await this.verificationService.sendVerificationOtp(email);
      throw new UnauthorizedException(
        'Usuário não verificado, verifique seu email.',
      );
    }

    if (user.totpEnabled) {
      const nonce = crypto.randomUUID();
      await this.redisService.setWithExpire(
        `auth:pending_2fa:${nonce}`,
        300,
        user.id,
      );
      return { requires2fa: true, nonce };
    }

    return await this.createSession(user.id, user.roles);
  }

  async login2fa(login2faDto: Login2faDto) {
    const { email, password, totp, nonce } = login2faDto;

    const user = await this.usersRepository.findByEmail(email);

    if (!user) throw new UnauthorizedException('Credenciais inválidas.');

    const isPasswordValid = await this.comparePassword(password, user.password);

    if (!isPasswordValid)
      throw new UnauthorizedException('Credenciais inválidas.');

    const pendingUserId = await this.redisService.get<string>(
      `auth:pending_2fa:${nonce}`,
    );

    if (!pendingUserId)
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');

    if (pendingUserId !== user.id) throw new UnauthorizedException();

    if (!user.totpEnabled || !user.totpSecret)
      throw new BadRequestException('2FA não ativo nesta conta');

    const secret = this.securityService.decryptData(user.totpSecret);

    const result = verifySync({ token: totp, secret });

    if (!result.valid) throw new UnauthorizedException('Código inválido');

    await this.redisService.remove(`auth:pending_2fa:${nonce}`);

    return await this.createSession(user.id, user.roles);
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const responseMsg = `Um email foi enviado para ${email} com um link para alterar sua senha.`;

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
      subject: 'Esqueci a Senha',
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

    if (!updatePassword) throw new BadRequestException('token inválido');

    const nowDate = new Date();

    if (nowDate > updatePassword.expiresAt) {
      throw new BadRequestException(
        'tempo expirado, inicie o processo novamente',
      );
    }

    const hashedNewPassword = await this.generatePasswordHash(newPassword);

    await this.usersRepository.update(updatePassword.userId, {
      password: hashedNewPassword,
    });

    await this.changePassRepository.deleteByToken(hashedToken);

    return 'senha alterada com sucesso';
  }

  async verifyOtp({ otp, email }: VerifyOtpDto) {
    const redisKey = `otp:verification:${email}`;
    const otpData = await this.redisService.get<OtpData>(redisKey);
    const hashedOtp = this.securityService.hashData(otp);

    if (!otpData) {
      throw new BadRequestException('OTP expirado ou não encontrado');
    }

    if (otpData.attempts >= 5) {
      await this.redisService.remove(redisKey);
      await this.verificationService.sendVerificationOtp(email);
      throw new BadRequestException(
        'Muitas tentativas. Um novo código foi enviado para seu email.',
      );
    }

    if (otpData.otp !== hashedOtp) {
      const updated = await this.redisService.update(redisKey, {
        ...otpData,
        attempts: otpData.attempts + 1,
      });

      if (!updated) {
        throw new BadRequestException('OTP expirado ou não encontrado');
      }

      throw new BadRequestException('OTP inválido');
    }

    const user = await this.usersRepository.findByEmail(email);

    if (!user) {
      throw new BadRequestException('Usuário não encontrado');
    }

    const updatedUser = await this.usersRepository.update(user.id, {
      verifiedEmail: true,
    });

    await this.redisService.remove(redisKey);

    return await this.createSession(updatedUser.id, updatedUser.roles);
  }

  async logout(sid: string, userId: string) {
    await Promise.all([
      this.redisService.remove(`auth:session:${sid}`),
      this.redisService.removeFromList(`auth:user_sessions:${userId}`, sid),
    ]);
  }

  async logoutAll(userId: string, currentSid: string) {
    const sessions = await this.redisService.getList(
      `auth:user_sessions:${userId}`,
    );

    const sessionsToLogout = sessions.filter((sid) => sid !== currentSid);

    await Promise.all([
      ...sessionsToLogout.map((sid) =>
        this.redisService.remove(`auth:session:${sid}`),
      ),
      ...sessionsToLogout.map((sid) =>
        this.redisService.removeFromList(`auth:user_sessions:${userId}`, sid),
      ),
    ]);
  }

  private async createSession(userId: string, roles: UserRole[]) {
    const sid = crypto.randomUUID();
    const days = Number(this.configService.get('JWT_EXPIRES_IN_DAYS'));
    const expiresIn = days * 24 * 60 * 60;

    await Promise.all([
      this.redisService.setWithExpire(`auth:session:${sid}`, expiresIn, userId),
      this.redisService.addToList(`auth:user_sessions:${userId}`, sid),
      this.redisService.setExpire(`auth:user_sessions:${userId}`, expiresIn),
    ]);

    return await this.jwtService.signAsync({
      sub: userId,
      sid,
      roles,
    });
  }

  private async generatePasswordHash(password: string) {
    return await bcrypt.hash(password, 12);
  }

  private async comparePassword(password: string, hash: string) {
    return await bcrypt.compare(password, hash);
  }
}

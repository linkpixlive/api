import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { verifySync } from 'otplib';
import {
  DUMMY_PASSWORD_HASH,
  MAX_TOTP_ATTEMPTS,
} from 'src/common/constants/auth.constants';
import {
  decryptData,
  encryptData,
  hashData,
} from 'src/common/utils/crypto.util';
import { ChangePasswordRepository } from 'src/infra/db/repositories/change-password.repositories';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { EmailService } from 'src/infra/queues/email/email.service';
import { REDIS_TTL, RedisKeys } from 'src/infra/redis/redis-keys';
import { RedisService } from 'src/infra/redis/redis.service';
import { ProfileService } from '../profile/profile.service';
import { SafeUser } from './entities/safe-user.entity';
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

interface Pending2fa {
  userId: string;
  attempts: number;
}

interface SessionTokenPayload {
  sub: string;
  sid: string;
}

@Injectable()
export class AuthService {
  constructor(
    private usersRepository: UsersRepository,
    private changePassRepository: ChangePasswordRepository,
    private jwtService: JwtService,
    private emailService: EmailService,
    private redisService: RedisService,
    private configService: ConfigService,
    private profileService: ProfileService,
    private verificationService: VerificationService,
  ) {}

  async register(registerAuthDto: RegisterAuthDto) {
    const { name, username, email, password, cpf } = registerAuthDto;
    const hashedCpf = hashData(cpf);

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

    const encryptedCpf = encryptData(cpf);
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
      if (!emailUser.verifiedEmail) {
        await this.verificationService.sendVerificationOtp(email);
      }

      return 'Verifique seu email e finalize o cadastro.';
    }

    await this.usersRepository.create(userData);

    await this.verificationService.sendVerificationOtp(email);

    return 'Verifique seu email e finalize o cadastro.';
  }

  async login(loginAuthDto: LoginAuthDto) {
    const { email, password } = loginAuthDto;

    const user = await this.usersRepository.findByEmail(email);

    const isPasswordValid = await this.comparePassword(
      password,
      user?.password ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !isPasswordValid)
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
        RedisKeys.authPending2fa(nonce),
        REDIS_TTL.authPending2fa,
        { userId: user.id, attempts: 0 } satisfies Pending2fa,
      );
      return { requires2fa: true, nonce };
    }

    return await this.createSession(user.id);
  }

  async login2fa(login2faDto: Login2faDto) {
    const { email, password, totp, nonce } = login2faDto;

    const user = await this.usersRepository.findByEmail(email);

    const isPasswordValid = await this.comparePassword(
      password,
      user?.password ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !isPasswordValid)
      throw new UnauthorizedException('Credenciais inválidas.');

    const pending = await this.redisService.get<Pending2fa>(
      RedisKeys.authPending2fa(nonce),
    );

    if (!pending)
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');

    if (pending.userId !== user.id) throw new UnauthorizedException();

    if (!user.totpEnabled || !user.totpSecret)
      throw new BadRequestException('2FA não ativo nesta conta');

    if (pending.attempts >= MAX_TOTP_ATTEMPTS) {
      await this.redisService.remove(RedisKeys.authPending2fa(nonce));
      throw new UnauthorizedException(
        'Muitas tentativas. Faça login novamente.',
      );
    }

    const secret = decryptData(user.totpSecret);

    const result = verifySync({ token: totp, secret });

    if (!result.valid) {
      const updated = await this.redisService.update(
        RedisKeys.authPending2fa(nonce),
        { ...pending, attempts: pending.attempts + 1 },
      );

      if (!updated)
        throw new UnauthorizedException(
          'Sessão expirada. Faça login novamente.',
        );

      throw new UnauthorizedException('Código inválido');
    }

    await this.redisService.remove(RedisKeys.authPending2fa(nonce));

    return await this.createSession(user.id);
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const responseMsg = `Um email foi enviado para ${email} com um link para alterar sua senha.`;

    const user = await this.usersRepository.findByEmail(email);
    if (!user) return responseMsg;

    await this.changePassRepository.deleteManyByUserId(user.id);

    const uuid = crypto.randomUUID();
    const hashedUUID = hashData(uuid);

    const expiresDate = new Date();
    expiresDate.setMinutes(expiresDate.getMinutes() + 15);

    await this.changePassRepository.create({
      token: hashedUUID,
      expiresAt: expiresDate,
      userId: user.id,
    });

    await this.emailService.sendEmail({
      to: email,
      subject: 'Esqueci a Senha',
      templateName: 'forgot-password',
      context: { link: `https://linkpix.com.br/forgot-password?token=${uuid}` },
      metadata: {},
    });

    return responseMsg;
  }

  async resetPassword(resetPassword: ResetPasswordDto) {
    const { newPassword, token } = resetPassword;

    const hashedToken = hashData(token);

    const updatePassword =
      await this.changePassRepository.findByToken(hashedToken);

    if (!updatePassword) throw new BadRequestException('token inválido');

    const nowDate = new Date();

    if (nowDate > updatePassword.expiresAt) {
      throw new BadRequestException(
        'Tempo expirado, inicie o processo novamente',
      );
    }

    const hashedNewPassword = await this.generatePasswordHash(newPassword);

    await this.usersRepository.update(updatePassword.userId, {
      password: hashedNewPassword,
    });

    await this.killAllSessions(updatePassword.userId);

    await this.changePassRepository.deleteManyByUserId(updatePassword.userId);

    return 'senha alterada com sucesso';
  }

  async verifyOtp({ otp, email }: VerifyOtpDto) {
    const redisKey = RedisKeys.otpVerification(email);
    const otpData = await this.redisService.get<OtpData>(redisKey);
    const hashedOtp = hashData(otp);

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

    const storedOtp = Buffer.from(otpData.otp, 'hex');
    const computedOtp = Buffer.from(hashedOtp, 'hex');
    const otpMatches =
      storedOtp.length === computedOtp.length &&
      crypto.timingSafeEqual(storedOtp, computedOtp);

    if (!otpMatches) {
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

    return await this.createSession(updatedUser.id);
  }

  async validateSessionToken(token: string) {
    let payload: SessionTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<SessionTokenPayload>(token);
    } catch {
      throw new UnauthorizedException();
    }

    if (!payload.sub || !payload.sid) throw new UnauthorizedException();

    const session = await this.redisService.get<string>(
      RedisKeys.session(payload.sid),
    );
    if (session !== payload.sub) throw new UnauthorizedException();

    const user = await this.usersRepository.findById(payload.sub);
    if (!user?.active) throw new UnauthorizedException();

    return {
      user: SafeUser.fromPrisma(user),
      sid: payload.sid,
    };
  }

  async logout(sid: string, userId: string) {
    await Promise.all([
      this.redisService.remove(RedisKeys.session(sid)),
      this.redisService.removeFromList(RedisKeys.userSessions(userId), sid),
    ]);
  }

  async logoutAll(userId: string, currentSid: string) {
    await this.killAllSessions(userId, currentSid);
  }

  private async createSession(userId: string) {
    const sid = crypto.randomUUID();
    const days = Number(this.configService.get('JWT_EXPIRES_IN_DAYS'));
    const expiresIn = days * 24 * 60 * 60;

    await Promise.all([
      this.redisService.setWithExpire(
        RedisKeys.session(sid),
        expiresIn,
        userId,
      ),
      this.redisService.addToList(RedisKeys.userSessions(userId), sid),
      this.redisService.setExpire(RedisKeys.userSessions(userId), expiresIn),
    ]);

    return await this.jwtService.signAsync({
      sub: userId,
      sid,
    });
  }

  private async killAllSessions(userId: string, exceptSid?: string) {
    const sessions = await this.redisService.getList(
      RedisKeys.userSessions(userId),
    );

    const sessionsToKill = sessions.filter((sid) => sid !== exceptSid);

    await Promise.all([
      ...sessionsToKill.map((sid) =>
        this.redisService.remove(RedisKeys.session(sid)),
      ),
      ...sessionsToKill.map((sid) =>
        this.redisService.removeFromList(RedisKeys.userSessions(userId), sid),
      ),
    ]);
  }

  private async generatePasswordHash(password: string) {
    return await bcrypt.hash(password, 12);
  }

  private async comparePassword(password: string, hash: string) {
    return await bcrypt.compare(password, hash);
  }
}

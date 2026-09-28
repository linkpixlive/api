import { BadRequestException, Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import { hashData } from 'src/common/utils/crypto.util';
import { EmailService } from 'src/infra/queues/email/email.service';
import { REDIS_TTL, RedisKeys } from 'src/infra/redis/redis-keys';
import { RedisService } from 'src/infra/redis/redis.service';

interface CooldownData {
  createdAt: Date | string;
}

interface OtpData extends CooldownData {
  otp: string;
  attempts: number;
}

interface EmailChangeOtpData extends CooldownData {
  email: string;
  otp: string;
}

const MAX_OTP_ATTEMPTS = 5;
const OTP_COOLDOWN_SECONDS = 60;

@Injectable()
export class VerificationService {
  constructor(
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
  ) {}

  async sendVerificationOtp(email: string): Promise<void> {
    const redisKey = RedisKeys.otpVerification(email);
    await this.assertCooldown(redisKey);

    const otp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = hashData(otp);

    await this.redisService.setWithExpire(redisKey, REDIS_TTL.otpVerification, {
      otp: hashedOtp,
      attempts: 0,
      createdAt: new Date(),
    } satisfies OtpData);

    await this.emailService.sendEmail({
      to: email,
      subject: 'Verifique seu email',
      templateName: 'verify-email',
      context: { otp },
      metadata: {},
    });
  }

  async sendEmailChangeOtp(userId: string, email: string): Promise<void> {
    const redisKey = RedisKeys.emailChangeVerification(userId);
    await this.assertCooldown(redisKey);

    const otp = crypto.randomInt(100000, 999999).toString();
    await this.redisService.remove(RedisKeys.emailChangeAttempts(userId));

    await this.redisService.setWithExpire(
      redisKey,
      REDIS_TTL.emailChangeVerification,
      {
        email,
        otp: hashData(otp),
        createdAt: new Date(),
      } satisfies EmailChangeOtpData,
    );

    await this.emailService.sendEmail({
      to: email,
      subject: 'Confirme seu novo email',
      templateName: 'verify-email',
      context: { otp },
      metadata: {},
    });
  }

  async verifyEmailChangeOtp(userId: string, otp: string): Promise<string> {
    const redisKey = RedisKeys.emailChangeVerification(userId);
    const pending = await this.redisService.get<EmailChangeOtpData>(redisKey);

    if (!pending) {
      throw new BadRequestException(
        'Solicitação expirada ou não encontrada. Inicie novamente.',
      );
    }

    const storedOtp = Buffer.from(pending.otp, 'hex');
    const computedOtp = Buffer.from(hashData(otp), 'hex');
    const otpMatches =
      storedOtp.length === computedOtp.length &&
      crypto.timingSafeEqual(storedOtp, computedOtp);

    if (!otpMatches) {
      const attempts = await this.redisService.incrementWithExpire(
        RedisKeys.emailChangeAttempts(userId),
        REDIS_TTL.emailChangeVerification,
      );

      if (attempts >= MAX_OTP_ATTEMPTS) {
        await this.clearEmailChangeOtp(userId);
        throw new BadRequestException('Muitas tentativas. Inicie novamente.');
      }

      throw new BadRequestException('Código inválido');
    }

    return pending.email;
  }

  async clearEmailChangeOtp(userId: string): Promise<void> {
    await Promise.all([
      this.redisService.remove(RedisKeys.emailChangeVerification(userId)),
      this.redisService.remove(RedisKeys.emailChangeAttempts(userId)),
    ]);
  }

  private async assertCooldown(redisKey: string): Promise<void> {
    const existing = await this.redisService.get<CooldownData>(redisKey);
    if (!existing) return;

    const secondsPassed = Math.floor(
      (Date.now() - new Date(existing.createdAt).getTime()) / 1000,
    );

    if (secondsPassed < OTP_COOLDOWN_SECONDS) {
      const secondsLeft = OTP_COOLDOWN_SECONDS - secondsPassed;
      throw new BadRequestException(
        `Aguarde ${secondsLeft} segundos para solicitar um novo código.`,
      );
    }
  }
}

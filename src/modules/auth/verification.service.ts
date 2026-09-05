import { BadRequestException, Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import { EmailService } from 'src/infra/queues/email/email.service';
import { RedisKeys, REDIS_TTL } from 'src/infra/redis/redis-keys';
import { RedisService } from 'src/infra/redis/redis.service';
import { SecurityService } from 'src/common/security/security.service';

interface OtpData {
  otp: string;
  attempts: number;
  createdAt: Date;
}

@Injectable()
export class VerificationService {
  constructor(
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
    private readonly securityService: SecurityService,
  ) {}

  async sendVerificationOtp(email: string): Promise<void> {
    const otp = crypto.randomInt(100000, 999999).toString();
    const redisKey = RedisKeys.otpVerification(email);

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
          `Aguarde ${secondsLeft} segundos para solicitar um novo código.`,
        );
      }
    }

    await this.redisService.setWithExpire(redisKey, REDIS_TTL.otpVerification, {
      otp: hashedOtp,
      attempts: 0,
      createdAt: new Date(),
    });

    await this.emailService.sendEmail({
      to: email,
      subject: 'Verifique seu email',
      templateName: 'verify-email',
      context: { otp },
      metadata: {},
    });
  }
}

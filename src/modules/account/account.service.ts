import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { generateSecret, generateURI, verifySync } from 'otplib';
import { MAX_TOTP_ATTEMPTS } from 'src/common/constants/auth.constants';
import {
  assertPassword,
  assertPasswordWithOptionalTotp,
  assertStepUp,
} from 'src/common/security/step-up.util';
import { decryptData, encryptData } from 'src/common/utils/crypto.util';
import { ChangePasswordRepository } from 'src/infra/db/repositories/change-password.repositories';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { REDIS_TTL, RedisKeys } from 'src/infra/redis/redis-keys';
import { RedisService } from 'src/infra/redis/redis.service';
import { SafeUser } from '../auth/entities/safe-user.entity';
import { VerificationService } from '../auth/verification.service';
import { ChangeEmailDto } from './dto/change-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ConfirmEmailChangeDto } from './dto/confirm-email-change.dto';
import { DeactivateAccountDto } from './dto/deactivate-account.dto';
import { Disable2faDto } from './dto/disable-2fa.dto';
import { Enable2faDto } from './dto/enable-2fa.dto';
import { Setup2faDto } from './dto/setup-2fa.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AccountEntity } from './entities/account.entity';

interface Pending2faSetup {
  encryptedSecret: string;
  attempts: number;
}

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly changePasswordRepository: ChangePasswordRepository,
    private readonly redisService: RedisService,
    private readonly verificationService: VerificationService,
  ) {}

  getSettings(user: SafeUser) {
    return AccountEntity.fromSafeUser(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const update: Record<string, string> = {};

    if (dto.name !== undefined) update.name = dto.name;

    if (Object.keys(update).length === 0)
      throw new BadRequestException('Nenhum campo para atualizar');

    await this.usersRepository.update(userId, update);
    return { name: update.name };
  }

  async changeEmail(user: SafeUser, currentSid: string, dto: ChangeEmailDto) {
    await assertStepUp(user, dto);

    if (dto.email === user.email) {
      throw new BadRequestException(
        'O novo email deve ser diferente do email atual.',
      );
    }

    const existing = await this.usersRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email já está em uso');
    }

    await this.verificationService.sendEmailChangeOtp(user.id, dto.email);
    await this.killAllSessionsExceptCurrent(user.id, currentSid);

    this.logger.log(`Email change requested: userId=${user.id}`);

    return {
      message: 'Confirme o novo email com o código enviado para verificá-lo.',
    };
  }

  async confirmEmailChange(
    user: SafeUser,
    currentSid: string,
    dto: ConfirmEmailChangeDto,
  ) {
    const email = await this.verificationService.verifyEmailChangeOtp(
      user.id,
      dto.otp,
    );

    const existing = await this.usersRepository.findByEmail(email);
    if (existing && existing.id !== user.id) {
      throw new ConflictException('Email já está em uso');
    }

    const updated =
      await this.changePasswordRepository.updateEmailAndInvalidateTokens(
        user.id,
        email,
      );

    if (!updated) {
      throw new ConflictException('Email já está em uso');
    }

    await this.verificationService.clearEmailChangeOtp(user.id);
    await this.killAllSessionsExceptCurrent(user.id, currentSid);

    this.logger.log(`Email changed: userId=${user.id}`);

    return { message: 'Email atualizado com sucesso.' };
  }

  async changePassword(
    user: SafeUser,
    dto: ChangePasswordDto,
    currentSid: string,
  ) {
    await assertPasswordWithOptionalTotp(user, dto.currentPassword, dto.totp);

    const newHash = await bcrypt.hash(dto.newPassword, 12);
    await this.changePasswordRepository.updatePasswordAndInvalidateTokens(
      user.id,
      newHash,
    );

    await this.killAllSessionsExceptCurrent(user.id, currentSid);

    this.logger.log(`Password changed: userId=${user.id}`);

    return { message: 'Senha alterada com sucesso.' };
  }

  async deactivateAccount(user: SafeUser, dto: DeactivateAccountDto) {
    await assertStepUp(user, dto);

    await this.usersRepository.update(user.id, { active: false });
    await this.killAllSessions(user.id);

    this.logger.log(`Account deactivated: userId=${user.id}`);

    return { message: 'Conta desativada. Faça login para reativar.' };
  }

  async setup2fa(user: SafeUser, dto: Setup2faDto) {
    await assertPassword(user, dto.password);

    if (user.totpEnabled) throw new BadRequestException('2FA já está ativo');

    const secret = generateSecret();
    const encryptedSecret = encryptData(secret);

    await this.redisService.setWithExpire(
      RedisKeys.totpSetup(user.id),
      REDIS_TTL.totpSetup,
      {
        encryptedSecret,
        attempts: 0,
      } satisfies Pending2faSetup,
    );

    const otpauthUrl = generateURI({
      issuer: 'LinkPix',
      label: user.username,
      secret,
    });

    return { otpauthUrl, secret };
  }

  async enable2fa(userId: string, currentSid: string, dto: Enable2faDto) {
    const pending = await this.redisService.get<Pending2faSetup>(
      RedisKeys.totpSetup(userId),
    );
    if (!pending) {
      throw new BadRequestException(
        'Configuração expirada ou não iniciada. Reinicie o setup.',
      );
    }

    if (pending.attempts >= MAX_TOTP_ATTEMPTS) {
      await this.redisService.remove(RedisKeys.totpSetup(userId));
      throw new BadRequestException(
        'Muitas tentativas. Reinicie o setup do 2FA.',
      );
    }

    const secret = decryptData(pending.encryptedSecret);
    const result = verifySync({ token: dto.token, secret });

    if (!result.valid) {
      const updated = await this.redisService.update(
        RedisKeys.totpSetup(userId),
        { ...pending, attempts: pending.attempts + 1 },
      );

      if (!updated) {
        throw new BadRequestException(
          'Configuração expirada ou não iniciada. Reinicie o setup.',
        );
      }

      throw new BadRequestException('Código inválido');
    }

    await this.usersRepository.update(userId, {
      totpSecret: pending.encryptedSecret,
      totpEnabled: true,
    });

    await this.redisService.remove(RedisKeys.totpSetup(userId));
    await this.killAllSessionsExceptCurrent(userId, currentSid);

    this.logger.log(`2FA enabled: userId=${userId}`);

    return { message: '2FA ativado com sucesso.' };
  }

  async disable2fa(user: SafeUser, dto: Disable2faDto) {
    await assertPasswordWithOptionalTotp(user, dto.password, dto.token);

    if (!user.totpEnabled || !user.totpSecret) {
      throw new BadRequestException('2FA não está ativo nesta conta');
    }

    await this.usersRepository.update(user.id, {
      totpSecret: null,
      totpEnabled: false,
    });

    this.logger.log(`2FA disabled: userId=${user.id}`);

    return { message: '2FA desativado.' };
  }

  private async killAllSessions(userId: string): Promise<void> {
    const sessions = await this.redisService.getList(
      RedisKeys.userSessions(userId),
    );

    await Promise.all([
      ...sessions.map((sid) =>
        this.redisService.remove(RedisKeys.session(sid)),
      ),
      ...sessions.map((sid) =>
        this.redisService.removeFromList(RedisKeys.userSessions(userId), sid),
      ),
    ]);
  }

  private async killAllSessionsExceptCurrent(
    userId: string,
    currentSid: string,
  ): Promise<void> {
    const sessions = await this.redisService.getList(
      RedisKeys.userSessions(userId),
    );

    const sessionsToKill = sessions.filter((sid) => sid !== currentSid);

    await Promise.all([
      ...sessionsToKill.map((sid) =>
        this.redisService.remove(RedisKeys.session(sid)),
      ),
      ...sessionsToKill.map((sid) =>
        this.redisService.removeFromList(RedisKeys.userSessions(userId), sid),
      ),
    ]);
  }
}

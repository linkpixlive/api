import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { generateSecret, generateURI, verifySync } from 'otplib';
import { SecurityService } from 'src/common/security/security.service';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { RedisService } from 'src/infra/redis/redis.service';
import { SafeUser } from '../auth/entities/safe-user.entity';
import { VerificationService } from '../auth/verification.service';
import { ChangeEmailDto } from './dto/change-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeactivateAccountDto } from './dto/deactivate-account.dto';
import { Disable2faDto } from './dto/disable-2fa.dto';
import { Enable2faDto } from './dto/enable-2fa.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AccountSettingsEntity } from './entities/account-settings.entity';

interface Pending2faSetup {
  encryptedSecret: string;
}

@Injectable()
export class AccountSettingsService {
  private readonly logger = new Logger(AccountSettingsService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly securityService: SecurityService,
    private readonly redisService: RedisService,
    private readonly verificationService: VerificationService,
  ) {}

  getSettings(user: SafeUser) {
    return AccountSettingsEntity.fromSafeUser(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const update: Record<string, string> = {};

    if (dto.name !== undefined) update.name = dto.name;

    if (Object.keys(update).length === 0)
      throw new BadRequestException('Nenhum campo para atualizar');

    await this.usersRepository.update(userId, update);
    return update;
  }

  async changeEmail(user: SafeUser, dto: ChangeEmailDto) {
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid)
      throw new UnauthorizedException('Credenciais inválidas');

    const existing = await this.usersRepository.findByEmail(dto.email);
    if (existing && existing.id !== user.id)
      throw new ConflictException('Email já está em uso');

    await this.usersRepository.update(user.id, {
      email: dto.email,
      verifiedEmail: false,
    });

    await this.killAllSessions(user.id);

    await this.verificationService.sendVerificationOtp(dto.email);

    this.logger.log(`Email changed: userId=${user.id}`);

    return { message: 'Email atualizado. Verifique o novo endereço.' };
  }

  async changePassword(
    user: SafeUser,
    dto: ChangePasswordDto,
    currentSid: string,
  ) {
    const isPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );
    if (!isPasswordValid)
      throw new UnauthorizedException('Credenciais inválidas');

    const newHash = await bcrypt.hash(dto.newPassword, 12);

    await this.usersRepository.update(user.id, { password: newHash });

    await this.killAllSessionsExceptCurrent(user.id, currentSid);

    this.logger.log(`Password changed: userId=${user.id}`);

    return { message: 'Senha alterada com sucesso.' };
  }

  async deactivateAccount(user: SafeUser, dto: DeactivateAccountDto) {
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid)
      throw new UnauthorizedException('Credenciais inválidas');

    await this.usersRepository.update(user.id, { active: false });

    await this.killAllSessions(user.id);

    this.logger.log(`Account deactivated: userId=${user.id}`);

    return { message: 'Conta desativada. Faça login para reativar.' };
  }

  async setup2fa(user: SafeUser) {
    if (user.totpEnabled) throw new BadRequestException('2FA já está ativo');

    const secret = generateSecret();
    const encryptedSecret = this.securityService.encryptData(secret);

    await this.redisService.setWithExpire(`totp:setup:${user.id}`, 600, {
      encryptedSecret,
    } satisfies Pending2faSetup);

    const otpauthUrl = generateURI({
      issuer: 'LinkPix',
      label: user.username,
      secret,
    });

    return { otpauthUrl, secret };
  }

  async enable2fa(userId: string, dto: Enable2faDto) {
    const pending = await this.redisService.get<Pending2faSetup>(
      `totp:setup:${userId}`,
    );
    if (!pending) {
      throw new BadRequestException(
        'Configuração expirada ou não iniciada. Reinicie o setup.',
      );
    }

    const secret = this.securityService.decryptData(pending.encryptedSecret);

    const result = verifySync({ token: dto.token, secret });

    if (!result.valid) throw new BadRequestException('Código inválido');

    await this.usersRepository.update(userId, {
      totpSecret: pending.encryptedSecret,
      totpEnabled: true,
    });

    await this.redisService.remove(`totp:setup:${userId}`);

    this.logger.log(`2FA enabled: userId=${userId}`);

    return { message: '2FA ativado com sucesso.' };
  }

  async disable2fa(user: SafeUser, dto: Disable2faDto) {
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid)
      throw new UnauthorizedException('Credenciais inválidas');

    await this.usersRepository.update(user.id, {
      totpSecret: null,
      totpEnabled: false,
    });

    this.logger.log(`2FA disabled: userId=${user.id}`);

    return { message: '2FA desativado.' };
  }

  private async killAllSessions(userId: string): Promise<void> {
    const sessions = await this.redisService.getList(
      `auth:user_sessions:${userId}`,
    );

    await Promise.all([
      ...sessions.map((sid) => this.redisService.remove(`auth:session:${sid}`)),
      ...sessions.map((sid) =>
        this.redisService.removeFromList(`auth:user_sessions:${userId}`, sid),
      ),
    ]);
  }

  private async killAllSessionsExceptCurrent(
    userId: string,
    currentSid: string,
  ): Promise<void> {
    const sessions = await this.redisService.getList(
      `auth:user_sessions:${userId}`,
    );

    const sessionsToKill = sessions.filter((sid) => sid !== currentSid);

    await Promise.all([
      ...sessionsToKill.map((sid) =>
        this.redisService.remove(`auth:session:${sid}`),
      ),
      ...sessionsToKill.map((sid) =>
        this.redisService.removeFromList(`auth:user_sessions:${userId}`, sid),
      ),
    ]);
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PixKey, PixKeyType } from '@prisma/client';
import { cnpj, cpf } from 'cpf-cnpj-validator';
import {
  PIX_EMAIL_REGEX,
  PIX_PHONE_REGEX,
  PIX_RANDOM_REGEX,
} from '../../common/decorators/is-pix-key.decorator';
import { SecurityService } from '../../common/security/security.service';
import { maskPixKey } from '../../common/utils/mask.util';
import { PixKeysRepository } from '../../infra/db/repositories/pix-keys.repositories';
import { SafeUser } from '../auth/entities/safe-user.entity';
import { CreatePixKeyDto } from './dto/create-pix-key.dto';
import { PixKeyEntity } from './entities/pix-key.entity';

const MAX_PIX_KEYS_PER_USER = 5;

@Injectable()
export class PixKeysService {
  constructor(
    private pixKeysRepository: PixKeysRepository,
    private securityService: SecurityService,
  ) {}

  async create(user: SafeUser, dto: CreatePixKeyDto): Promise<PixKeyEntity> {
    const keyType = this.detectKeyType(dto.key);

    const count = await this.pixKeysRepository.countByUserId(user.id);

    if (count >= MAX_PIX_KEYS_PER_USER) {
      throw new BadRequestException(
        `You can register up to ${MAX_PIX_KEYS_PER_USER} Pix keys.`,
      );
    }

    const keyHash = this.securityService.hashData(dto.key);
    const existing = await this.pixKeysRepository.findByUserIdAndKeyHash(
      user.id,
      keyHash,
    );

    if (existing) {
      throw new ConflictException('This Pix key is already registered.');
    }

    const encryptedKey = this.securityService.encryptData(dto.key);
    const maskedKey = maskPixKey(keyType, dto.key);

    const pixKey = await this.pixKeysRepository.create({
      userId: user.id,
      key: encryptedKey,
      keyHashed: keyHash,
      keyMasked: maskedKey,
      keyType,
      alias: dto.alias,
    });

    return this.mapToEntity(pixKey);
  }

  async findAll(user: SafeUser): Promise<PixKeyEntity[]> {
    const pixKeys = await this.pixKeysRepository.findByUserId(user.id);
    return pixKeys.map((pk) => this.mapToEntity(pk));
  }

  async findAllMasked(user: SafeUser): Promise<PixKeyEntity[]> {
    const pixKeys = await this.pixKeysRepository.findByUserId(user.id);
    return pixKeys.map((pk) => this.mapToEntityMasked(pk));
  }

  async remove(user: SafeUser, id: string): Promise<PixKeyEntity> {
    const pixKey = await this.pixKeysRepository.findById(id);

    if (!pixKey || pixKey.user_id !== user.id) {
      throw new NotFoundException('Pix key not found.');
    }

    const deleted = await this.pixKeysRepository.delete(user.id, id);
    return this.mapToEntity(deleted);
  }

  private detectKeyType(key: string): PixKeyType {
    if (PIX_RANDOM_REGEX.test(key)) return 'random';
    if (PIX_EMAIL_REGEX.test(key)) return 'email';
    if (PIX_PHONE_REGEX.test(key)) return 'phone';

    const digits = key.replace(/\D/g, '');

    if (digits.length === 11 && cpf.isValid(digits)) return 'cpf';
    if (digits.length === 14 && cnpj.isValid(digits)) return 'cnpj';

    throw new BadRequestException('Invalid Pix key format.');
  }

  private mapToEntity(pixKey: PixKey): PixKeyEntity {
    const decryptedKey = this.securityService.decryptData(pixKey.key);

    return new PixKeyEntity({
      id: pixKey.id,
      key: decryptedKey,
      keyMasked: pixKey.key_masked,
      keyType: pixKey.key_type,
      alias: pixKey.alias || undefined,
      createdAt: pixKey.created_at,
    });
  }

  private mapToEntityMasked(pixKey: PixKey): PixKeyEntity {
    return new PixKeyEntity({
      id: pixKey.id,
      keyMasked: pixKey.key_masked,
      keyType: pixKey.key_type,
      alias: pixKey.alias || undefined,
      createdAt: pixKey.created_at,
    });
  }
}

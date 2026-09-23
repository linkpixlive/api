import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { UploadedFile } from 'src/common/interfaces/uploaded-file.interface';
import { getStorageUrl } from 'src/common/utils/storageUrl.util';
import { UsernameBlacklistRepository } from 'src/infra/db/repositories/username-blacklist.repositories';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { StorageContract } from 'src/infra/storage/contract/storage.contract';
import { UpdateUsernameDto } from './dto/update-username.dto';

export const MAX_PROFILE_PHOTO_SIZE_BYTES = 2 * 1024 * 1024;

const ALLOWED_PROFILE_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const PROFILE_PHOTO_MAX_DIMENSION = 512;
const PROFILE_PHOTO_WEBP_QUALITY = 80;

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private usersRepository: UsersRepository,
    private usernameBlacklistRepository: UsernameBlacklistRepository,
    private storage: StorageContract,
  ) {}

  async validateUsernameAvailability(username: string) {
    const blacklistRecord =
      await this.usernameBlacklistRepository.findByUsername(username);

    if (blacklistRecord) {
      if (blacklistRecord.expiresAt === null) {
        throw new BadRequestException(
          'Este nome de usuário está permanentemente bloqueado.',
        );
      }

      const now = new Date();
      if (blacklistRecord.expiresAt <= now) {
        await this.usernameBlacklistRepository.delete(blacklistRecord.id);
        return;
      }

      const remainingDays = Math.ceil(
        (blacklistRecord.expiresAt.getTime() - now.getTime()) / 86400000,
      );

      throw new BadRequestException(
        `Este nome de usuário está na lista de bloqueio. ${remainingDays} dia(s) restante(s) até a liberação.`,
      );
    }

    const existingUser = await this.usersRepository.findByUsername(username);
    if (existingUser) {
      throw new BadRequestException('Nome de usuário já está em uso');
    }
  }

  async changeUsername(userId: string, updateUsernameDto: UpdateUsernameDto) {
    const { newUsername } = updateUsernameDto;

    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new BadRequestException('Usuário não encontrado');
    }

    if (user.usernameChangedAt) {
      const now = new Date();
      const diffMs = now.getTime() - user.usernameChangedAt.getTime();
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffDays < 15) {
        const remainingDays = 15 - diffDays;
        throw new BadRequestException(
          `Você só pode alterar seu nome de usuário a cada 15 dias. ${remainingDays} dia(s) restante(s).`,
        );
      }
    }

    await this.validateUsernameAvailability(newUsername);

    const oldUsername = user.username;
    const expiresAt = user.verified
      ? null
      : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    await this.usersRepository.changeUsernameWithBlacklist(
      userId,
      oldUsername,
      newUsername,
      expiresAt,
    );

    return { username: newUsername };
  }

  async uploadProfilePhoto(userId: string, file?: UploadedFile) {
    if (!file) {
      throw new BadRequestException('Arquivo não enviado');
    }

    this.validateImageFile(file);

    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new BadRequestException('Usuário não encontrado');
    }

    const buffer = await this.convertToWebP(file.buffer);

    const oldKey = user.profileImageUrl;
    const key = `avatars/${userId}/${randomUUID()}.webp`;

    await this.storage.upload(buffer, key, 'image/webp');
    await this.usersRepository.update(userId, { profileImageUrl: key });

    await this.deleteObjectBestEffort(oldKey, userId);

    return { profileImageUrl: getStorageUrl(key) };
  }

  async removeProfilePhoto(userId: string) {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new BadRequestException('Usuário não encontrado');
    }

    const oldKey = user.profileImageUrl;

    if (!oldKey) {
      return { profileImageUrl: null };
    }

    await this.usersRepository.update(userId, { profileImageUrl: null });
    await this.deleteObjectBestEffort(oldKey, userId);

    return { profileImageUrl: null };
  }

  private validateImageFile(file: UploadedFile): void {
    if (!ALLOWED_PROFILE_PHOTO_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Formato de imagem inválido. Formatos aceitos: JPEG, PNG e WebP.',
      );
    }

    if (file.buffer.length > MAX_PROFILE_PHOTO_SIZE_BYTES) {
      throw new BadRequestException('Imagem excede o tamanho máximo de 2 MB.');
    }
  }

  private async convertToWebP(buffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(buffer)
        .rotate()
        .resize(PROFILE_PHOTO_MAX_DIMENSION, PROFILE_PHOTO_MAX_DIMENSION, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: PROFILE_PHOTO_WEBP_QUALITY })
        .toBuffer();
    } catch {
      throw new BadRequestException('Arquivo não é uma imagem válida.');
    }
  }

  private async deleteObjectBestEffort(
    key: string | null,
    userId: string,
  ): Promise<void> {
    if (!key) {
      return;
    }

    try {
      await this.storage.deleteObject(key);
    } catch (error) {
      this.logger.warn(
        `Falha ao remover objeto antigo ${key} do storage (usuário ${userId}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { UsernameBlacklistRepository } from 'src/infra/db/repositories/username-blacklist.repositories';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { UpdateUsernameDto } from './dto/update-username.dto';

@Injectable()
export class ProfileService {
  constructor(
    private usersRepository: UsersRepository,
    private usernameBlacklistRepository: UsernameBlacklistRepository,
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
}

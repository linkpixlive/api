import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateUsernameBlacklistParams } from './dto/username-blacklist.dto';

@Injectable()
export class UsernameBlacklistRepository {
  constructor(private prismaService: PrismaService) {}

  async findByUsername(username: string) {
    return await this.prismaService.usernameBlacklist.findUnique({
      where: { username },
    });
  }

  async create(data: CreateUsernameBlacklistParams) {
    return await this.prismaService.usernameBlacklist.create({
      data: {
        username: data.username,
        originalOwnerId: data.originalOwnerId,
        expiresAt: data.expiresAt,
      },
    });
  }

  async delete(id: string) {
    return await this.prismaService.usernameBlacklist.delete({
      where: { id },
    });
  }

  async deleteByUsername(username: string) {
    return await this.prismaService.usernameBlacklist.delete({
      where: { username },
    });
  }
}

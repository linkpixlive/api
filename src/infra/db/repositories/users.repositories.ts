import { Injectable } from '@nestjs/common';
import { UserRole, WidgetType } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateUserParams, UpdateUserParams } from './dto/users.dto';

@Injectable()
export class UsersRepository {
  constructor(private prismaService: PrismaService) {}

  async create(data: CreateUserParams) {
    return await this.prismaService.user.create({
      data: {
        name: data.name,
        username: data.username,
        email: data.email,
        password: data.password,
        cpf: data.cpf,
        cpfHash: data.cpfHash,
        roles: data.roles ?? [UserRole.streamer],
        verifiedEmail: data.verifiedEmail,
        verified: data.verified,
        usernameChangedAt: data.usernameChangedAt,
        wallet: { create: {} },
        donationSettings: { create: {} },
      },
    });
  }

  async findById(id: string) {
    return await this.prismaService.user.findUnique({ where: { id } });
  }

  async findByIdWithConfig(id: string) {
    return await this.prismaService.user.findUnique({
      where: { id },
      include: {
        donationSettings: true,
        widgets: {
          where: {
            type: WidgetType.overlay,
            active: true,
          },
          take: 1,
        },
      },
    });
  }

  async findByUsernameWithConfig(username: string) {
    return await this.prismaService.user.findUnique({
      where: { username },
      include: {
        donationSettings: true,
        widgets: {
          where: {
            type: WidgetType.overlay,
            active: true,
          },
          take: 1,
        },
      },
    });
  }

  async findByEmail(email: string) {
    return await this.prismaService.user.findUnique({ where: { email } });
  }

  async findByUsername(username: string) {
    return await this.prismaService.user.findUnique({ where: { username } });
  }

  async findByCpfHash(cpfHash: string) {
    return await this.prismaService.user.findUnique({
      where: { cpfHash },
    });
  }

  async update(userId: string, data: UpdateUserParams) {
    return await this.prismaService.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        username: data.username,
        email: data.email,
        password: data.password,
        cpf: data.cpf,
        cpfHash: data.cpfHash,
        roles: data.roles,
        verifiedEmail: data.verifiedEmail,
        verified: data.verified,
        usernameChangedAt: data.usernameChangedAt,
      },
    });
  }

  async changeUsernameWithBlacklist(
    userId: string,
    oldUsername: string,
    newUsername: string,
    blacklistExpiresAt: Date | null,
  ) {
    return await this.prismaService.$transaction(async (tx) => {
      await tx.usernameBlacklist.create({
        data: {
          username: oldUsername,
          originalOwnerId: userId,
          expiresAt: blacklistExpiresAt,
        },
      });

      return await tx.user.update({
        where: { id: userId },
        data: {
          username: newUsername,
          usernameChangedAt: new Date(),
        },
      });
    });
  }

  async deleteManyUnverified(olderThan: Date) {
    return await this.prismaService.user.deleteMany({
      where: {
        verifiedEmail: false,
        createdAt: {
          lt: olderThan,
        },
      },
    });
  }
}

import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
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
        wallet: { create: {} },
      },
    });
  }

  async findById(id: string) {
    return await this.prismaService.user.findUnique({ where: { id } });
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

  async findByOverlayKey(overlayKey: string) {
    return await this.prismaService.user.findUnique({
      where: { overlayKey },
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
      },
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

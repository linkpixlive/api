import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePixKeyParams } from './dto/pix-keys.dto';

@Injectable()
export class PixKeysRepository {
  constructor(private prismaService: PrismaService) {}

  async create(data: CreatePixKeyParams) {
    return await this.prismaService.pixKey.create({
      data: {
        userId: data.userId,
        key: data.key,
        keyHashed: data.keyHashed,
        keyMasked: data.keyMasked,
        keyType: data.keyType,
        alias: data.alias,
      },
    });
  }

  async findById(id: string) {
    return await this.prismaService.pixKey.findUnique({ where: { id } });
  }

  async findByUserIdAndKeyHash(userId: string, keyHashed: string) {
    return await this.prismaService.pixKey.findUnique({
      where: { userId_keyHashed: { userId, keyHashed } },
    });
  }

  async findByUserId(userId: string) {
    return await this.prismaService.pixKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async countByUserId(userId: string) {
    return await this.prismaService.pixKey.count({
      where: { userId },
    });
  }

  async delete(userId: string, id: string) {
    return await this.prismaService.pixKey.delete({
      where: { id, userId },
    });
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePixKeyParams } from './dto/pix-keys.dto';

@Injectable()
export class PixKeysRepository {
  constructor(private prismaService: PrismaService) {}

  async create(data: CreatePixKeyParams) {
    return await this.prismaService.pixKey.create({
      data: {
        user_id: data.userId,
        key: data.key,
        key_hashed: data.keyHashed,
        key_masked: data.keyMasked,
        key_type: data.keyType,
        alias: data.alias,
      },
    });
  }

  async findById(id: string) {
    return await this.prismaService.pixKey.findUnique({ where: { id } });
  }

  async findByUserIdAndKeyHash(userId: string, keyHash: string) {
    return await this.prismaService.pixKey.findUnique({
      where: { user_id_key_hashed: { user_id: userId, key_hashed: keyHash } },
    });
  }

  async findByUserId(userId: string) {
    return await this.prismaService.pixKey.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
  }

  async countByUserId(userId: string) {
    return await this.prismaService.pixKey.count({
      where: { user_id: userId },
    });
  }

  async delete(userId: string, id: string) {
    return await this.prismaService.pixKey.delete({
      where: { id, user_id: userId },
    });
  }
}

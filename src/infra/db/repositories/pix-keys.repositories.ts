import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreatePixKeyParams } from './dto/pix-keys.dto';
import {
  PixKeyAlreadyExistsError,
  PixKeyLimitReachedError,
} from '../../../common/errors/pix-keys.errors';

@Injectable()
export class PixKeysRepository {
  private static readonly MAX_SERIALIZABLE_RETRIES = 3;

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

  async createWithLimit(data: CreatePixKeyParams, maxKeys: number) {
    for (
      let attempt = 1;
      attempt <= PixKeysRepository.MAX_SERIALIZABLE_RETRIES;
      attempt++
    ) {
      try {
        return await this.prismaService.$transaction(
          async (tx) => {
            const count = await tx.pixKey.count({
              where: { userId: data.userId },
            });

            if (count >= maxKeys) {
              throw new PixKeyLimitReachedError(maxKeys);
            }

            return await tx.pixKey.create({
              data: {
                userId: data.userId,
                key: data.key,
                keyHashed: data.keyHashed,
                keyMasked: data.keyMasked,
                keyType: data.keyType,
                alias: data.alias,
              },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        const isSerializationConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034';

        if (
          isSerializationConflict &&
          attempt < PixKeysRepository.MAX_SERIALIZABLE_RETRIES
        ) {
          continue;
        }

        const isUniqueViolation =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002';

        if (isUniqueViolation) {
          throw new PixKeyAlreadyExistsError();
        }

        throw error;
      }
    }

    throw new Error('unreachable');
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

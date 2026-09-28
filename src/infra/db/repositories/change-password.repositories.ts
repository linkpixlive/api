import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ChangePasswordRepository {
  constructor(private prismaService: PrismaService) {}

  async replaceForUser(userId: string, token: string, expiresAt: Date) {
    return await this.prismaService.$transaction(async (tx) => {
      await tx.changePassword.deleteMany({ where: { userId } });
      return await tx.changePassword.create({
        data: { userId, token, expiresAt },
      });
    });
  }

  async existsValidToken(token: string, now: Date): Promise<boolean> {
    const record = await this.prismaService.changePassword.findFirst({
      where: { token, expiresAt: { gt: now } },
      select: { id: true },
    });

    return record !== null;
  }

  async consumeTokenAndUpdatePassword(
    token: string,
    now: Date,
    password: string,
  ): Promise<string | null> {
    return await this.prismaService.$transaction(async (tx) => {
      const consumed = await tx.$queryRaw<{ user_id: string }[]>`
        DELETE FROM "change_password"
        WHERE "token" = ${token} AND "expires_at" > ${now}
        RETURNING "user_id"
      `;

      const userId = consumed[0]?.user_id;
      if (!userId) return null;

      await tx.user.update({
        where: { id: userId },
        data: { password },
      });
      await tx.changePassword.deleteMany({ where: { userId } });

      return userId;
    });
  }

  async updatePasswordAndInvalidateTokens(
    userId: string,
    password: string,
  ): Promise<void> {
    await this.prismaService.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { password },
      });
      await tx.changePassword.deleteMany({ where: { userId } });
    });
  }

  async updateEmailAndInvalidateTokens(
    userId: string,
    email: string,
  ): Promise<boolean> {
    try {
      await this.prismaService.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { email },
        });
        await tx.changePassword.deleteMany({ where: { userId } });
      });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return false;
      }
      throw error;
    }
  }
}

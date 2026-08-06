import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WithdrawalStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  CreateWithdrawalParams,
  FindWithdrawalsParams,
} from './dto/withdrawals.dto';

@Injectable()
export class WithdrawalsRepository {
  constructor(private prismaService: PrismaService) {}

  async findById(id: string) {
    const withdrawal = await this.prismaService.withdrawal.findUnique({
      where: { id },
    });

    if (!withdrawal) {
      throw new NotFoundException('Withdrawal not found.');
    }

    return withdrawal;
  }

  async processWithdrawal(params: CreateWithdrawalParams) {
    try {
      return await this.prismaService.$transaction(async (tx) => {
        const withdrawal = await tx.withdrawal.create({
          data: {
            userId: params.userId,
            pixId: params.pixId,
            pixValue: params.pixKey,
            keyMasked: params.keyMasked,
            clientKey: params.clientKey ?? null,
            grossAmount: params.grossAmount,
            netAmount: params.netAmount,
            feeAmount: params.feeAmount,
            status: WithdrawalStatus.pending,
          },
        });

        await tx.wallet.update({
          where: {
            userId: params.userId,
            currentBalance: { gte: params.grossAmount },
          },
          data: {
            currentBalance: { decrement: params.grossAmount },
            pendingBalance: { increment: params.grossAmount },
          },
        });

        return withdrawal;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new BadRequestException('Insufficient available balance.');
      }
      throw error;
    }
  }

  async findByUserId(params: FindWithdrawalsParams) {
    const skip = (params.page - 1) * params.limit;

    const where: Partial<Prisma.WithdrawalWhereInput> = {
      userId: params.userId,
    };

    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = params.startDate;
      if (params.endDate) where.createdAt.lte = params.endDate;
    }

    if (params.status) {
      where.status = params.status;
    }

    const [total, data] = await Promise.all([
      this.prismaService.withdrawal.count({ where }),
      this.prismaService.withdrawal.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
      data,
    };
  }

  async processingWithdrawal(id: string, transactionId?: string) {
    return await this.prismaService.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawal.findUnique({
        where: { id },
      });

      if (!withdrawal) {
        throw new NotFoundException('Withdrawal not found.');
      }

      if (withdrawal.status !== WithdrawalStatus.pending) {
        throw new BadRequestException('Withdrawal is not pending.');
      }

      return await tx.withdrawal.update({
        where: { id },
        data: {
          status: WithdrawalStatus.processing,
          transactionId,
          updatedAt: new Date(),
        },
      });
    });
  }

  async approveWithdrawal(id: string, transactionId?: string) {
    return await this.prismaService.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawal.findUnique({
        where: { id },
      });

      if (!withdrawal) {
        throw new NotFoundException('Withdrawal not found.');
      }

      const updateResult = await tx.withdrawal.updateMany({
        where: { id, status: WithdrawalStatus.processing },
        data: {
          status: WithdrawalStatus.success,
          transactionId,
          updatedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        throw new BadRequestException(
          'Withdrawal is not processing or already processed.',
        );
      }

      const updatedWithdrawal = await tx.withdrawal.findUniqueOrThrow({
        where: { id },
      });

      const wallet = await tx.wallet.update({
        where: { userId: withdrawal.userId },
        data: {
          pendingBalance: { decrement: withdrawal.grossAmount },
        },
      });

      await tx.transaction.create({
        data: {
          userId: withdrawal.userId,
          withdrawalId: withdrawal.id,
          amount: withdrawal.grossAmount,
          type: 'withdraw_confirm',
          transactionId: transactionId ?? '',
          balanceAfter: wallet.currentBalance,
        },
      });

      return updatedWithdrawal;
    });
  }

  async rejectWithdrawal(id: string) {
    return await this.prismaService.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawal.findUnique({
        where: { id },
      });

      if (!withdrawal) {
        throw new NotFoundException('Withdrawal not found.');
      }

      const updateResult = await tx.withdrawal.updateMany({
        where: {
          id,
          status: {
            in: [WithdrawalStatus.pending, WithdrawalStatus.processing],
          },
        },
        data: {
          status: WithdrawalStatus.failed,
          updatedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        throw new BadRequestException(
          'Withdrawal is not pending or processing.',
        );
      }

      const updatedWithdrawal = await tx.withdrawal.findUniqueOrThrow({
        where: { id },
      });

      const wallet = await tx.wallet.update({
        where: { userId: withdrawal.userId },
        data: {
          pendingBalance: { decrement: withdrawal.grossAmount },
          currentBalance: { increment: withdrawal.grossAmount },
        },
      });

      await tx.transaction.create({
        data: {
          userId: withdrawal.userId,
          withdrawalId: withdrawal.id,
          amount: withdrawal.grossAmount,
          type: 'refund',
          transactionId: '',
          balanceAfter: wallet.currentBalance,
        },
      });

      return updatedWithdrawal;
    });
  }

  async findByClientKey(userId: string, clientKey: string) {
    return await this.prismaService.withdrawal.findFirst({
      where: {
        userId,
        clientKey,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findProcessingWithdrawals() {
    return await this.prismaService.withdrawal.findMany({
      where: { status: WithdrawalStatus.processing },
    });
  }
}

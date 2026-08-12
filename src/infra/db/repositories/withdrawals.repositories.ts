import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WithdrawalStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { PrismaService } from '../prisma.service';
import {
  CreateWithdrawalParams,
  FindWithdrawalsParams,
} from './dto/withdrawals.dto';
import { WalletsRepository } from './wallets.repositories';

@Injectable()
export class WithdrawalsRepository {
  constructor(
    private prismaService: PrismaService,
    private walletsRepository: WalletsRepository,
  ) {}

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

      await this.walletsRepository.reserveForWithdrawal(tx, {
        id: withdrawal.id,
        userId: params.userId,
        grossAmount: new Decimal(params.grossAmount),
      });

      return withdrawal;
    });
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

      await this.walletsRepository.confirmWithdrawal(
        tx,
        withdrawal,
        transactionId ?? '',
      );

      return updatedWithdrawal;
    });
  }

  async rejectWithdrawal(id: string, transactionId?: string) {
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
          ...(transactionId ? { transactionId } : {}),
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

      await this.walletsRepository.refundWithdrawal(
        tx,
        withdrawal,
        transactionId ?? '',
      );

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

  async findProcessingWithdrawals(limit = 100) {
    return await this.prismaService.withdrawal.findMany({
      where: { status: WithdrawalStatus.processing },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
  }
}

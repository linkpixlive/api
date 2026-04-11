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

  async processWithdrawal(params: CreateWithdrawalParams) {
    return await this.prismaService.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawal.create({
        data: {
          user_id: params.userId,
          pix_id: params.pixId,
          pix_value: params.pixKey,
          gross_amount: params.grossAmount,
          net_amount: params.netAmount,
          fee_amount: params.feeAmount,
          status: WithdrawalStatus.pending,
        },
      });

      await tx.wallet.update({
        where: { user_id: params.userId },
        data: {
          current_balance: { decrement: params.grossAmount },
          pending_balance: { increment: params.grossAmount },
        },
      });

      // await tx.transaction.create({
      //   data: {
      //     user_id: params.userId,
      //     withdrawal_id: withdrawal.id,
      //     amount: params.amount,
      //     type: 'withdraw_reserve',
      //     transaction_id: `withdraw-${withdrawal.id}`,
      //     balance_after: updatedWallet.current_balance,
      //   },
      // });

      return withdrawal;
    });
  }

  async findByUserId(params: FindWithdrawalsParams) {
    const skip = (params.page - 1) * params.limit;

    const where: Partial<Prisma.WithdrawalWhereInput> = {
      user_id: params.userId,
    };

    if (params.startDate || params.endDate) {
      where.created_at = {};
      if (params.startDate) where.created_at.gte = params.startDate;
      if (params.endDate) where.created_at.lte = params.endDate;
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
        orderBy: { created_at: 'desc' },
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

  async approveWithdrawal(id: string) {
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

      const updatedWithdrawal = await tx.withdrawal.update({
        where: { id },
        data: {
          status: WithdrawalStatus.success,
          updated_at: new Date(),
        },
      });

      const wallet = await tx.wallet.update({
        where: { user_id: withdrawal.user_id },
        data: {
          pending_balance: { decrement: withdrawal.gross_amount },
        },
      });

      await tx.transaction.create({
        data: {
          user_id: withdrawal.user_id,
          withdrawal_id: withdrawal.id,
          amount: withdrawal.gross_amount,
          type: 'withdraw_confirm',
          transaction_id: `withdraw-confirm-${withdrawal.id}`,
          balance_after: wallet.current_balance,
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

      if (withdrawal.status !== WithdrawalStatus.pending) {
        throw new BadRequestException('Withdrawal is not pending.');
      }

      const updatedWithdrawal = await tx.withdrawal.update({
        where: { id },
        data: {
          status: WithdrawalStatus.failed,
          updated_at: new Date(),
        },
      });

      const wallet = await tx.wallet.update({
        where: { user_id: withdrawal.user_id },
        data: {
          pending_balance: { decrement: withdrawal.gross_amount },
          current_balance: { increment: withdrawal.gross_amount },
        },
      });

      await tx.transaction.create({
        data: {
          user_id: withdrawal.user_id,
          withdrawal_id: withdrawal.id,
          amount: withdrawal.gross_amount,
          type: 'refund',
          transaction_id: `withdraw-reject-${withdrawal.id}`,
          balance_after: wallet.current_balance,
        },
      });

      return updatedWithdrawal;
    });
  }
}

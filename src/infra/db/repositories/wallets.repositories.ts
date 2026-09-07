import { Injectable } from '@nestjs/common';
import { Donation, TransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { PrismaService } from '../prisma.service';
import { FindWalletParams, ReconcileResult } from './dto/wallets.dto';
import {
  InsufficientBalanceError,
  WalletNotFoundError,
} from '../../../common/errors/wallets.errors';

type Tx = Omit<
  PrismaService,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

const RECONCILE_PAGE_SIZE = 500;

interface ApplyOpParams {
  userId: string;
  delta: Decimal;
  type: TransactionType;
  transactionId: string;
  pendingDelta?: Decimal;
  donationId?: string;
  withdrawalId?: string;
  ip?: string | null;
}

@Injectable()
export class WalletsRepository {
  constructor(private prismaService: PrismaService) {}

  async findByUserId(params: FindWalletParams) {
    return await this.prismaService.wallet.findUnique({
      where: { userId: params.userId },
    });
  }

  async creditDonation(tx: Tx, donation: Donation) {
    return this.applyOp(tx, {
      userId: donation.userId,
      delta: donation.amount,
      type: 'donation',
      transactionId: donation.transactionId,
      donationId: donation.id,
      ip: donation.ip,
    });
  }

  async reserveForWithdrawal(
    tx: Tx,
    withdrawal: { id: string; userId: string; grossAmount: Decimal },
  ) {
    return this.applyOp(tx, {
      userId: withdrawal.userId,
      delta: withdrawal.grossAmount.negated(),
      type: 'withdraw_reserve',
      transactionId: withdrawal.id,
      withdrawalId: withdrawal.id,
      pendingDelta: withdrawal.grossAmount,
    });
  }

  async confirmWithdrawal(
    tx: Tx,
    withdrawal: { id: string; userId: string; grossAmount: Decimal },
    transactionId: string,
  ) {
    return this.applyOp(tx, {
      userId: withdrawal.userId,
      delta: new Decimal(0),
      type: 'withdraw_confirm',
      transactionId,
      withdrawalId: withdrawal.id,
      pendingDelta: withdrawal.grossAmount.negated(),
    });
  }

  async refundWithdrawal(
    tx: Tx,
    withdrawal: { id: string; userId: string; grossAmount: Decimal },
    transactionId: string,
  ) {
    return this.applyOp(tx, {
      userId: withdrawal.userId,
      delta: withdrawal.grossAmount,
      type: 'refund',
      transactionId,
      withdrawalId: withdrawal.id,
      pendingDelta: withdrawal.grossAmount.negated(),
    });
  }

  /**
   * Core financial primitive. Locks the wallet row (serializing per-user
   * financial writes), derives the new balance from the previous ledger
   * entry (never from the wallet cache), appends the ledger entry, then
   * updates the wallet cache in a single write.
   */
  private async applyOp(tx: Tx, params: ApplyOpParams) {
    await tx.$queryRaw`
      SELECT id FROM wallets WHERE user_id = ${params.userId} FOR UPDATE
    `;

    const wallet = await tx.wallet.findUnique({
      where: { userId: params.userId },
    });

    if (!wallet) {
      throw new WalletNotFoundError();
    }

    const prevTx = wallet.lastTransactionId
      ? await tx.transaction.findUnique({
          where: { id: wallet.lastTransactionId },
        })
      : null;

    const prevBalance = prevTx ? prevTx.balanceAfter : new Decimal(0);
    const newBalance = prevBalance.plus(params.delta);

    if (newBalance.isNegative()) {
      throw new InsufficientBalanceError();
    }

    const txRow = await tx.transaction.create({
      data: {
        userId: params.userId,
        amount: params.delta,
        type: params.type,
        transactionId: params.transactionId,
        balanceAfter: newBalance,
        donationId: params.donationId ?? null,
        withdrawalId: params.withdrawalId ?? null,
        ip: params.ip ?? null,
      },
    });

    const pending = params.pendingDelta ?? new Decimal(0);

    await tx.wallet.update({
      where: { userId: params.userId },
      data: {
        currentBalance: newBalance,
        pendingBalance: wallet.pendingBalance.plus(pending),
        lastTransactionId: txRow.id,
      },
    });

    return txRow;
  }

  async reconcile(userId: string): Promise<ReconcileResult | null> {
    const wallet = await this.prismaService.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      return null;
    }

    let running = new Decimal(0);
    let chainValid = true;
    let cursor: string | undefined;

    while (true) {
      const ledger = await this.prismaService.transaction.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: RECONCILE_PAGE_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });

      if (ledger.length === 0) break;

      for (const entry of ledger) {
        const expected = running.plus(entry.amount);
        if (!expected.equals(entry.balanceAfter)) {
          chainValid = false;
        }
        running = entry.balanceAfter;
      }

      cursor = ledger[ledger.length - 1].id;
      if (ledger.length < RECONCILE_PAGE_SIZE) break;
    }

    const match = chainValid && running.equals(wallet.currentBalance);

    return {
      userId,
      walletBalance: wallet.currentBalance,
      ledgerBalance: running,
      chainValid,
      match,
    };
  }

  async findManyUserIds(skip: number, take: number): Promise<string[]> {
    const wallets = await this.prismaService.wallet.findMany({
      select: { userId: true },
      skip,
      take,
      orderBy: { userId: 'asc' },
    });
    return wallets.map((w) => w.userId);
  }
}

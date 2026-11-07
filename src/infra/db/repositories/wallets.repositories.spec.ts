import { Decimal } from '@prisma/client/runtime/client';
import {
  InsufficientBalanceError,
  WalletNotFoundError,
} from '../../../common/errors/wallets.errors';
import { WalletsRepository } from './wallets.repositories';

describe('WalletsRepository', () => {
  let tx: {
    $queryRaw: jest.Mock;
    wallet: Record<string, jest.Mock>;
    transaction: Record<string, jest.Mock>;
  };
  let prisma: Record<string, Record<string, jest.Mock>>;
  let repository: WalletsRepository;

  beforeEach(() => {
    tx = {
      $queryRaw: jest.fn(),
      wallet: { findUnique: jest.fn(), update: jest.fn() },
      transaction: { findUnique: jest.fn(), create: jest.fn() },
    };
    prisma = {
      wallet: { findUnique: jest.fn() },
      transaction: { findMany: jest.fn() },
    };
    repository = new WalletsRepository(prisma as never);
  });

  const wallet = (overrides: Record<string, unknown> = {}) => ({
    userId: 'user-1',
    currentBalance: new Decimal(999), // cache propositalmente divergente do ledger
    pendingBalance: new Decimal(0),
    lastTransactionId: 't-1',
    ...overrides,
  });

  const ledgerEntry = (overrides: Record<string, unknown> = {}) => ({
    id: 't-1',
    userId: 'user-1',
    amount: new Decimal(100),
    balanceAfter: new Decimal(100),
    type: 'donation',
    transactionId: 'efi-tx-0',
    createdAt: new Date('2026-01-01'),
    donationId: null,
    withdrawalId: null,
    ip: null,
    ...overrides,
  });

  const stubWalletWithLedger = (overrides: Record<string, unknown> = {}) => {
    tx.wallet.findUnique.mockResolvedValue(wallet(overrides));
    tx.transaction.findUnique.mockResolvedValue(ledgerEntry());
  };

  describe('applyOp (via creditDonation)', () => {
    const donation = () => ({
      id: 'don-1',
      userId: 'user-1',
      amount: new Decimal(10),
      transactionId: 'efi-tx-1',
      ip: null,
    });

    it('deriva o novo saldo do balanceAfter do ledger, nunca do cache da wallet', async () => {
      stubWalletWithLedger();
      tx.transaction.create.mockResolvedValue({ id: 't-2' });

      await repository.creditDonation(tx as never, donation() as never);

      // Cache diz 999; ledger diz 100. Novo saldo = 100 + 10 = 110.
      expect(tx.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: new Decimal(10),
          type: 'donation',
          balanceAfter: new Decimal(110),
          transactionId: 'efi-tx-1',
          donationId: 'don-1',
        }),
      });
    });

    it('atualiza o cache da wallet em uma única escrita com o id do ledger', async () => {
      stubWalletWithLedger();
      tx.transaction.create.mockResolvedValue({ id: 't-2' });

      await repository.creditDonation(tx as never, donation() as never);

      expect(tx.wallet.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: {
          currentBalance: new Decimal(110),
          pendingBalance: new Decimal(0),
          lastTransactionId: 't-2',
        },
      });
    });

    it('wallet sem última transação parte do saldo zero', async () => {
      tx.wallet.findUnique.mockResolvedValue(
        wallet({ lastTransactionId: null, currentBalance: new Decimal(0) }),
      );
      tx.transaction.create.mockResolvedValue({ id: 't-2' });

      await repository.creditDonation(tx as never, donation() as never);

      expect(tx.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ balanceAfter: new Decimal(10) }),
      });
    });

    it('trava a linha da wallet antes de ler (FOR UPDATE)', async () => {
      stubWalletWithLedger();
      tx.transaction.create.mockResolvedValue({ id: 't-2' });

      await repository.creditDonation(tx as never, donation() as never);

      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(tx.wallet.findUnique).toHaveBeenCalledTimes(1);
    });

    it('wallet inexistente → WalletNotFoundError', async () => {
      tx.wallet.findUnique.mockResolvedValue(null);

      await expect(
        repository.creditDonation(tx as never, donation() as never),
      ).rejects.toThrow(WalletNotFoundError);
    });
  });

  describe('reserveForWithdrawal', () => {
    it('debita o saldo, incrementa pending e grava type withdraw_reserve', async () => {
      stubWalletWithLedger({ pendingBalance: new Decimal(0) });
      tx.transaction.create.mockResolvedValue({ id: 't-2' });

      await repository.reserveForWithdrawal(tx as never, {
        id: 'w-1',
        userId: 'user-1',
        grossAmount: new Decimal(50),
      });

      expect(tx.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'withdraw_reserve',
          amount: new Decimal(-50),
          balanceAfter: new Decimal(50),
          withdrawalId: 'w-1',
        }),
      });
      expect(tx.wallet.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: {
          currentBalance: new Decimal(50),
          pendingBalance: new Decimal(50),
          lastTransactionId: 't-2',
        },
      });
    });

    it('saldo insuficiente → InsufficientBalanceError e nada é gravado', async () => {
      stubWalletWithLedger(); // ledger: 100

      await expect(
        repository.reserveForWithdrawal(tx as never, {
          id: 'w-1',
          userId: 'user-1',
          grossAmount: new Decimal(150),
        }),
      ).rejects.toThrow(InsufficientBalanceError);

      expect(tx.transaction.create).not.toHaveBeenCalled();
      expect(tx.wallet.update).not.toHaveBeenCalled();
    });
  });

  describe('confirmWithdrawal', () => {
    it('delta zero mantém saldo e baixa o pending', async () => {
      stubWalletWithLedger({ pendingBalance: new Decimal(50) });
      tx.transaction.create.mockResolvedValue({ id: 't-2' });

      await repository.confirmWithdrawal(
        tx as never,
        { id: 'w-1', userId: 'user-1', grossAmount: new Decimal(50) },
        'efi-tx-confirm',
      );

      expect(tx.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'withdraw_confirm',
          amount: new Decimal(0),
          balanceAfter: new Decimal(100),
          transactionId: 'efi-tx-confirm',
        }),
      });
      expect(tx.wallet.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: {
          currentBalance: new Decimal(100),
          pendingBalance: new Decimal(0),
          lastTransactionId: 't-2',
        },
      });
    });
  });

  describe('refundWithdrawal', () => {
    it('credita de volta e baixa o pending', async () => {
      stubWalletWithLedger({ pendingBalance: new Decimal(50) });
      tx.transaction.create.mockResolvedValue({ id: 't-2' });

      await repository.refundWithdrawal(
        tx as never,
        { id: 'w-1', userId: 'user-1', grossAmount: new Decimal(50) },
        'efi-tx-refund',
      );

      expect(tx.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'refund',
          amount: new Decimal(50),
          balanceAfter: new Decimal(150),
        }),
      });
      expect(tx.wallet.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: {
          currentBalance: new Decimal(150),
          pendingBalance: new Decimal(0),
          lastTransactionId: 't-2',
        },
      });
    });
  });

  describe('reconcile', () => {
    const findUniqueWallet = (currentBalance: Decimal) =>
      prisma.wallet.findUnique.mockResolvedValue(
        wallet({ currentBalance, lastTransactionId: 't-9' }),
      );

    it('cadeia válida que fecha com o cache → match true', async () => {
      findUniqueWallet(new Decimal(100));
      prisma.transaction.findMany.mockResolvedValue([
        ledgerEntry({ amount: new Decimal(60), balanceAfter: new Decimal(60) }),
        ledgerEntry({
          id: 't-2',
          amount: new Decimal(40),
          balanceAfter: new Decimal(100),
        }),
      ]);

      const result = await repository.reconcile('user-1');

      expect(result).toMatchObject({
        userId: 'user-1',
        chainValid: true,
        match: true,
        ledgerBalance: new Decimal(100),
      });
    });

    it('entrada que não corresponde à soma → chainValid false', async () => {
      findUniqueWallet(new Decimal(100));
      prisma.transaction.findMany.mockResolvedValue([
        ledgerEntry({ amount: new Decimal(60), balanceAfter: new Decimal(60) }),
        ledgerEntry({
          id: 't-2',
          amount: new Decimal(40),
          balanceAfter: new Decimal(90), // esperado 100
        }),
      ]);

      const result = await repository.reconcile('user-1');

      expect(result).toMatchObject({ chainValid: false, match: false });
    });

    it('ledger íntegro mas cache divergente → match false', async () => {
      findUniqueWallet(new Decimal(50)); // cache drift
      prisma.transaction.findMany.mockResolvedValue([
        ledgerEntry({ amount: new Decimal(60), balanceAfter: new Decimal(60) }),
        ledgerEntry({
          id: 't-2',
          amount: new Decimal(40),
          balanceAfter: new Decimal(100),
        }),
      ]);

      const result = await repository.reconcile('user-1');

      expect(result).toMatchObject({
        chainValid: true,
        match: false,
        walletBalance: new Decimal(50),
        ledgerBalance: new Decimal(100),
      });
    });

    it('carteira inexistente → null', async () => {
      prisma.wallet.findUnique.mockResolvedValue(null);

      await expect(repository.reconcile('ghost')).resolves.toBeNull();
    });

    it('pagina a leitura do ledger com cursor entre páginas', async () => {
      findUniqueWallet(new Decimal(10));

      const page1 = Array.from({ length: 500 }, (_, i) =>
        ledgerEntry({
          id: `t-${i}`,
          amount: new Decimal(0),
          balanceAfter: new Decimal(0),
        }),
      );
      prisma.transaction.findMany
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce([
          ledgerEntry({
            id: 't-500',
            amount: new Decimal(10),
            balanceAfter: new Decimal(10),
          }),
        ]);

      const result = await repository.reconcile('user-1');

      expect(prisma.transaction.findMany).toHaveBeenCalledTimes(2);
      expect(prisma.transaction.findMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ skip: 1, cursor: { id: 't-499' } }),
      );
      expect(result).toMatchObject({ chainValid: true, match: true });
    });
  });
});

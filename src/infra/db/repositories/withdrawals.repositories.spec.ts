import { Prisma, WithdrawalStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import {
  WithdrawalClientKeyConflictError,
  WithdrawalInvalidStatusError,
  WithdrawalNotFoundError,
} from '../../../common/errors/withdrawals.errors';
import { WithdrawalsRepository } from './withdrawals.repositories';

describe('WithdrawalsRepository', () => {
  let tx: Record<string, Record<string, jest.Mock>>;
  let prisma: Record<string, jest.Mock>;
  let walletsRepository: Record<string, jest.Mock>;
  let repository: WithdrawalsRepository;

  beforeEach(() => {
    tx = {
      withdrawal: {
        create: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
    };
    prisma = { $transaction: jest.fn((fn) => fn(tx)) };
    walletsRepository = {
      reserveForWithdrawal: jest.fn(),
      confirmWithdrawal: jest.fn(),
      refundWithdrawal: jest.fn(),
    };
    repository = new WithdrawalsRepository(
      prisma as never,
      walletsRepository as never,
    );
  });

  const params = () => ({
    userId: 'user-1',
    pixId: 'pix-1',
    pixKey: 'chave',
    keyMasked: '***',
    clientKey: 'client-key-1',
    grossAmount: 100,
    netAmount: new Decimal(95),
    feeAmount: new Decimal(5),
  });

  const withdrawal = (overrides: Record<string, unknown> = {}) => ({
    id: 'w-1',
    userId: 'user-1',
    status: WithdrawalStatus.pending,
    transactionId: null,
    grossAmount: new Decimal(100),
    ...overrides,
  });

  describe('processWithdrawal', () => {
    it('cria withdrawal pending e reserva o valor na carteira', async () => {
      tx.withdrawal.create.mockResolvedValue(withdrawal());

      await repository.processWithdrawal(params());

      expect(tx.withdrawal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          status: WithdrawalStatus.pending,
          clientKey: 'client-key-1',
        }),
      });
      expect(walletsRepository.reserveForWithdrawal).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ userId: 'user-1' }),
      );
    });

    it('violação de unique (P2002) → WithdrawalClientKeyConflictError', async () => {
      tx.withdrawal.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(repository.processWithdrawal(params())).rejects.toThrow(
        WithdrawalClientKeyConflictError,
      );
    });
  });

  describe('processingWithdrawal', () => {
    it('transiciona pending → processing', async () => {
      tx.withdrawal.findUnique.mockResolvedValue(withdrawal());
      tx.withdrawal.updateMany.mockResolvedValue({ count: 1 });
      tx.withdrawal.findUniqueOrThrow.mockResolvedValue(
        withdrawal({ status: WithdrawalStatus.processing }),
      );

      const result = await repository.processingWithdrawal('w-1', 'tx-1');

      expect(tx.withdrawal.updateMany).toHaveBeenCalledWith({
        where: { id: 'w-1', status: WithdrawalStatus.pending },
        data: expect.objectContaining({ status: WithdrawalStatus.processing }),
      });
      expect(result.status).toBe(WithdrawalStatus.processing);
    });

    it('count 0 (status não é pending) → WithdrawalInvalidStatusError', async () => {
      tx.withdrawal.findUnique.mockResolvedValue(
        withdrawal({ status: WithdrawalStatus.success }),
      );
      tx.withdrawal.updateMany.mockResolvedValue({ count: 0 });

      await expect(repository.processingWithdrawal('w-1')).rejects.toThrow(
        WithdrawalInvalidStatusError,
      );
    });

    it('withdrawal inexistente → WithdrawalNotFoundError', async () => {
      tx.withdrawal.findUnique.mockResolvedValue(null);

      await expect(repository.processingWithdrawal('x')).rejects.toThrow(
        WithdrawalNotFoundError,
      );
    });
  });

  describe('approveWithdrawal', () => {
    it('processing → success e confirma a reserva (delta 0, pending −gross)', async () => {
      const row = withdrawal({ status: WithdrawalStatus.processing });
      tx.withdrawal.findUnique.mockResolvedValue(row);
      tx.withdrawal.updateMany.mockResolvedValue({ count: 1 });
      tx.withdrawal.findUniqueOrThrow.mockResolvedValue(
        withdrawal({ status: WithdrawalStatus.success }),
      );

      const result = await repository.approveWithdrawal('w-1', 'tx-1');

      expect(tx.withdrawal.updateMany).toHaveBeenCalledWith({
        where: { id: 'w-1', status: WithdrawalStatus.processing },
        data: expect.objectContaining({ status: WithdrawalStatus.success }),
      });
      expect(walletsRepository.confirmWithdrawal).toHaveBeenCalledWith(
        tx,
        row,
        'tx-1',
      );
      expect(result.status).toBe(WithdrawalStatus.success);
    });

    it('sem transactionId usa fallback confirm:<id>', async () => {
      tx.withdrawal.findUnique.mockResolvedValue(
        withdrawal({ status: WithdrawalStatus.processing }),
      );
      tx.withdrawal.updateMany.mockResolvedValue({ count: 1 });
      tx.withdrawal.findUniqueOrThrow.mockResolvedValue(
        withdrawal({ status: WithdrawalStatus.success }),
      );

      await repository.approveWithdrawal('w-1');

      expect(walletsRepository.confirmWithdrawal).toHaveBeenCalledWith(
        tx,
        expect.anything(),
        'confirm:w-1',
      );
    });

    it('count 0 (não está processing) → WithdrawalInvalidStatusError e não confirma', async () => {
      tx.withdrawal.findUnique.mockResolvedValue(
        withdrawal({ status: WithdrawalStatus.pending }),
      );
      tx.withdrawal.updateMany.mockResolvedValue({ count: 0 });

      await expect(repository.approveWithdrawal('w-1')).rejects.toThrow(
        WithdrawalInvalidStatusError,
      );
      expect(walletsRepository.confirmWithdrawal).not.toHaveBeenCalled();
    });
  });

  describe('rejectWithdrawal', () => {
    it('pending → failed e refunda o valor', async () => {
      const row = withdrawal({ status: WithdrawalStatus.pending });
      tx.withdrawal.findUnique.mockResolvedValue(row);
      tx.withdrawal.updateMany.mockResolvedValue({ count: 1 });
      tx.withdrawal.findUniqueOrThrow.mockResolvedValue(
        withdrawal({ status: WithdrawalStatus.failed }),
      );

      await repository.rejectWithdrawal('w-1');

      expect(tx.withdrawal.updateMany).toHaveBeenCalledWith({
        where: { id: 'w-1', status: WithdrawalStatus.pending },
        data: expect.objectContaining({ status: WithdrawalStatus.failed }),
      });
      expect(walletsRepository.refundWithdrawal).toHaveBeenCalledWith(
        tx,
        row,
        'refund:w-1',
      );
    });

    it('count 0 (não está pending) → WithdrawalInvalidStatusError e não refunda', async () => {
      tx.withdrawal.findUnique.mockResolvedValue(
        withdrawal({ status: WithdrawalStatus.processing }),
      );
      tx.withdrawal.updateMany.mockResolvedValue({ count: 0 });

      await expect(repository.rejectWithdrawal('w-1')).rejects.toThrow(
        WithdrawalInvalidStatusError,
      );
      expect(walletsRepository.refundWithdrawal).not.toHaveBeenCalled();
    });
  });

  describe('failProcessingWithdrawal', () => {
    it('processing → failed e refunda o valor', async () => {
      const row = withdrawal({ status: WithdrawalStatus.processing });
      tx.withdrawal.findUnique.mockResolvedValue(row);
      tx.withdrawal.updateMany.mockResolvedValue({ count: 1 });
      tx.withdrawal.findUniqueOrThrow.mockResolvedValue(
        withdrawal({ status: WithdrawalStatus.failed }),
      );

      await repository.failProcessingWithdrawal('w-1', 'tx-1');

      expect(tx.withdrawal.updateMany).toHaveBeenCalledWith({
        where: { id: 'w-1', status: WithdrawalStatus.processing },
        data: expect.objectContaining({ status: WithdrawalStatus.failed }),
      });
      expect(walletsRepository.refundWithdrawal).toHaveBeenCalledWith(
        tx,
        row,
        'tx-1',
      );
    });

    it('count 0 (não está processing) → WithdrawalInvalidStatusError', async () => {
      tx.withdrawal.findUnique.mockResolvedValue(
        withdrawal({ status: WithdrawalStatus.success }),
      );
      tx.withdrawal.updateMany.mockResolvedValue({ count: 0 });

      await expect(repository.failProcessingWithdrawal('w-1')).rejects.toThrow(
        WithdrawalInvalidStatusError,
      );
      expect(walletsRepository.refundWithdrawal).not.toHaveBeenCalled();
    });
  });
});

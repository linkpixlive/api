import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { WithdrawalStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { GatewayContract } from 'src/infra/gateway/contract/gateway.contract';
import { SentPixStatus } from 'src/common/interfaces/sent-pix-status.type';
import { WithdrawalClientKeyConflictError } from 'src/common/errors/withdrawals.errors';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { WithdrawalsService } from './withdrawals.service';

jest.mock('src/common/security/step-up.util', () => ({
  assertPasswordWithOptionalTotp: jest.fn(() => Promise.resolve()),
  assertPassword: jest.fn(() => Promise.resolve()),
  assertTotp: jest.fn(),
}));

describe('WithdrawalsService', () => {
  let withdrawalsRepository: Record<string, jest.Mock>;
  let walletsRepository: Record<string, jest.Mock>;
  let pixKeysRepository: Record<string, jest.Mock>;
  let usersRepository: Record<string, jest.Mock>;
  let configService: Record<string, jest.Mock>;
  let gateway: Record<string, jest.Mock>;
  let service: WithdrawalsService;

  beforeEach(() => {
    withdrawalsRepository = {
      findByClientKey: jest.fn(),
      processWithdrawal: jest.fn(),
      findById: jest.fn(),
      approveWithdrawal: jest.fn(),
      rejectWithdrawal: jest.fn(),
      failProcessingWithdrawal: jest.fn(),
    };
    walletsRepository = { findByUserId: jest.fn() };
    pixKeysRepository = { findById: jest.fn() };
    usersRepository = { findById: jest.fn() };
    configService = { getOrThrow: jest.fn() };
    gateway = { getSentPixStatus: jest.fn() };

    service = new WithdrawalsService(
      withdrawalsRepository as never,
      walletsRepository as never,
      pixKeysRepository as never,
      usersRepository as never,
      configService as never,
      gateway as unknown as GatewayContract,
    );
  });

  const user = (): AuthenticatedUser => ({
    id: 'user-1',
    name: 'Streamer',
    email: 'streamer@example.com',
    username: 'streamer',
    profileImageUrl: null,
    createdAt: new Date(),
    active: true,
    verifiedEmail: true,
    usernameChangedAt: null,
    roles: [],
    totpEnabled: false,
  });

  const dto = (overrides: Partial<CreateWithdrawalDto> = {}) => ({
    amount: 100,
    pixId: 'pix-1',
    password: 'senha',
    ...overrides,
  });

  const pixKey = () => ({
    id: 'pix-1',
    userId: 'user-1',
    key: 'chave-pix',
    keyMasked: '***-pix',
    keyType: 'random',
  });

  const withdrawalRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'w-1',
    userId: 'user-1',
    pixId: 'pix-1',
    pixValue: null,
    keyMasked: '***-pix',
    grossAmount: new Decimal(100),
    netAmount: new Decimal(95),
    feeAmount: new Decimal(5),
    status: WithdrawalStatus.pending,
    transactionId: null,
    createdAt: new Date(),
    ...overrides,
  });

  const stubHappyPath = (feePercentage = 5) => {
    usersRepository.findById.mockResolvedValue(user());
    withdrawalsRepository.findByClientKey.mockResolvedValue(null);
    configService.getOrThrow.mockImplementation((key: string) =>
      key === 'MIN_WITHDRAWAL_AMOUNT' ? 10 : feePercentage,
    );
    walletsRepository.findByUserId.mockResolvedValue({
      userId: 'user-1',
      currentBalance: new Decimal(500),
      pendingBalance: new Decimal(0),
    });
    pixKeysRepository.findById.mockResolvedValue(pixKey());
    withdrawalsRepository.processWithdrawal.mockResolvedValue(withdrawalRow());
  };

  describe('create — cálculo de taxa', () => {
    it('calcula fee e net com Decimal (5% de R$100)', async () => {
      stubHappyPath(5);

      await service.create(user(), dto(), 'client-key-1');

      expect(withdrawalsRepository.processWithdrawal).toHaveBeenCalledWith(
        expect.objectContaining({
          grossAmount: 100,
          feeAmount: new Decimal('5.00'),
          netAmount: new Decimal('95.00'),
        }),
      );
    });

    it('arredonda a taxa para 2 casas (3% de R$10,05 → R$0,30)', async () => {
      stubHappyPath(3);

      await service.create(user(), dto({ amount: 10.05 }), 'client-key-2');

      const call = withdrawalsRepository.processWithdrawal.mock.calls[0][0];
      expect(call.feeAmount.toNumber()).toBe(0.3);
      expect(call.netAmount.toNumber()).toBe(9.75);
    });

    it('aceita percentual fracionário (7,5% de R$100 → R$7,50)', async () => {
      stubHappyPath(7.5);

      await service.create(user(), dto(), 'client-key-3');

      const call = withdrawalsRepository.processWithdrawal.mock.calls[0][0];
      expect(call.feeAmount.toNumber()).toBe(7.5);
      expect(call.netAmount.toNumber()).toBe(92.5);
    });
  });

  describe('create — validações', () => {
    it('rejeita valor abaixo do mínimo configurado', async () => {
      stubHappyPath();
      configService.getOrThrow.mockImplementation((key: string) =>
        key === 'MIN_WITHDRAWAL_AMOUNT' ? 50 : 5,
      );

      await expect(
        service.create(user(), dto({ amount: 49.99 }), 'k'),
      ).rejects.toThrow(BadRequestException);
      expect(withdrawalsRepository.processWithdrawal).not.toHaveBeenCalled();
    });

    it('rejeita quando o usuário não existe mais', async () => {
      stubHappyPath();
      usersRepository.findById.mockResolvedValue(null);

      await expect(service.create(user(), dto(), 'k')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejeita quando a carteira não existe', async () => {
      stubHappyPath();
      walletsRepository.findByUserId.mockResolvedValue(null);

      await expect(service.create(user(), dto(), 'k')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejeita chave Pix de outro usuário', async () => {
      stubHappyPath();
      pixKeysRepository.findById.mockResolvedValue({
        ...pixKey(),
        userId: 'user-2',
      });

      await expect(service.create(user(), dto(), 'k')).rejects.toThrow(
        NotFoundException,
      );
      expect(withdrawalsRepository.processWithdrawal).not.toHaveBeenCalled();
    });
  });

  describe('create — idempotência por clientKey', () => {
    it('mesma request retorna a withdraw existente sem criar outra', async () => {
      stubHappyPath();
      const existing = withdrawalRow({ grossAmount: new Decimal(100) });
      withdrawalsRepository.findByClientKey.mockResolvedValue(existing);

      const result = await service.create(user(), dto({ amount: 100 }), 'k');

      expect(withdrawalsRepository.processWithdrawal).not.toHaveBeenCalled();
      expect(result.amount).toBe(100);
    });

    it('clientKey reutilizada com request diferente conflita', async () => {
      stubHappyPath();
      withdrawalsRepository.findByClientKey.mockResolvedValue(
        withdrawalRow({ grossAmount: new Decimal(100), pixId: 'pix-1' }),
      );

      await expect(
        service.create(user(), dto({ amount: 200 }), 'k'),
      ).rejects.toThrow(WithdrawalClientKeyConflictError);
    });

    it('conflict na criação (corrida P2002) re-lê e devolve a existente', async () => {
      stubHappyPath();
      withdrawalsRepository.findByClientKey
        .mockResolvedValueOnce(null) // checagem inicial
        .mockResolvedValueOnce(
          withdrawalRow({ grossAmount: new Decimal(100) }),
        ); // re-read após conflito
      withdrawalsRepository.processWithdrawal.mockRejectedValue(
        new WithdrawalClientKeyConflictError(),
      );

      const result = await service.create(user(), dto({ amount: 100 }), 'k');

      expect(result.amount).toBe(100);
    });

    it('conflict com request divergente propaga o erro', async () => {
      stubHappyPath();
      withdrawalsRepository.findByClientKey
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(
          withdrawalRow({ grossAmount: new Decimal(999), pixId: 'other' }),
        );
      withdrawalsRepository.processWithdrawal.mockRejectedValue(
        new WithdrawalClientKeyConflictError(),
      );

      await expect(
        service.create(user(), dto({ amount: 100 }), 'k'),
      ).rejects.toThrow(WithdrawalClientKeyConflictError);
    });
  });

  describe('handleWebhookPixSend', () => {
    const ID_32HEX = '1234567890abcdef1234567890abcdef';
    const UUID = '12345678-90ab-cdef-1234-567890abcdef';

    it('converte o id de 32 hex para UUID e aprova em SUCCESS', async () => {
      withdrawalsRepository.findById.mockResolvedValue(
        withdrawalRow({ status: WithdrawalStatus.pending }),
      );
      gateway.getSentPixStatus.mockResolvedValue({
        status: SentPixStatus.SUCCESS,
        transactionId: 'efi-tx-1',
      });

      await service.handleWebhookPixSend(ID_32HEX);

      expect(withdrawalsRepository.findById).toHaveBeenCalledWith(UUID);
      expect(withdrawalsRepository.approveWithdrawal).toHaveBeenCalledWith(
        UUID,
        'efi-tx-1',
      );
    });

    it('ignora id que não é 32 hex', async () => {
      await service.handleWebhookPixSend('nao-hex');

      expect(withdrawalsRepository.findById).not.toHaveBeenCalled();
      expect(gateway.getSentPixStatus).not.toHaveBeenCalled();
    });

    it('ignora withdrawal inexistente', async () => {
      withdrawalsRepository.findById.mockResolvedValue(null);

      await service.handleWebhookPixSend(ID_32HEX);

      expect(gateway.getSentPixStatus).not.toHaveBeenCalled();
    });

    it('ignora withdrawal já finalizado (status success)', async () => {
      withdrawalsRepository.findById.mockResolvedValue(
        withdrawalRow({ status: WithdrawalStatus.success }),
      );

      await service.handleWebhookPixSend(ID_32HEX);

      expect(gateway.getSentPixStatus).not.toHaveBeenCalled();
    });

    it('status PROCESSING do gateway não altera nada', async () => {
      withdrawalsRepository.findById.mockResolvedValue(
        withdrawalRow({ status: WithdrawalStatus.processing }),
      );
      gateway.getSentPixStatus.mockResolvedValue({
        status: SentPixStatus.PROCESSING,
        transactionId: null,
      });

      await service.handleWebhookPixSend(ID_32HEX);

      expect(withdrawalsRepository.approveWithdrawal).not.toHaveBeenCalled();
      expect(withdrawalsRepository.rejectWithdrawal).not.toHaveBeenCalled();
      expect(
        withdrawalsRepository.failProcessingWithdrawal,
      ).not.toHaveBeenCalled();
    });

    it('FAILED em withdrawal processing chama failProcessingWithdrawal (com refund)', async () => {
      withdrawalsRepository.findById.mockResolvedValue(
        withdrawalRow({ status: WithdrawalStatus.processing }),
      );
      gateway.getSentPixStatus.mockResolvedValue({
        status: SentPixStatus.FAILED,
        transactionId: 'efi-tx-2',
      });

      await service.handleWebhookPixSend(ID_32HEX);

      expect(
        withdrawalsRepository.failProcessingWithdrawal,
      ).toHaveBeenCalledWith(UUID, 'efi-tx-2');
      expect(withdrawalsRepository.rejectWithdrawal).not.toHaveBeenCalled();
    });

    it('FAILED em withdrawal pending chama rejectWithdrawal', async () => {
      withdrawalsRepository.findById.mockResolvedValue(
        withdrawalRow({ status: WithdrawalStatus.pending }),
      );
      gateway.getSentPixStatus.mockResolvedValue({
        status: SentPixStatus.FAILED,
        transactionId: null,
      });

      await service.handleWebhookPixSend(ID_32HEX);

      expect(withdrawalsRepository.rejectWithdrawal).toHaveBeenCalledWith(
        UUID,
        null,
      );
    });

    it('transactionId divergente entre gateway e DB aborta', async () => {
      withdrawalsRepository.findById.mockResolvedValue(
        withdrawalRow({
          status: WithdrawalStatus.processing,
          transactionId: 'tx-original',
        }),
      );
      gateway.getSentPixStatus.mockResolvedValue({
        status: SentPixStatus.SUCCESS,
        transactionId: 'tx-outro',
      });

      await service.handleWebhookPixSend(ID_32HEX);

      expect(withdrawalsRepository.approveWithdrawal).not.toHaveBeenCalled();
    });
  });
});

import { Decimal } from '@prisma/client/runtime/client';
import {
  DonationAlreadyProcessedError,
  DonationNotFoundError,
} from '../../../common/errors/donations.errors';
import { DonationsRepository } from './donations.repositories';

describe('DonationsRepository — processDonation', () => {
  let tx: Record<string, Record<string, jest.Mock>>;
  let prisma: Record<string, jest.Mock>;
  let walletsRepository: Record<string, jest.Mock>;
  let repository: DonationsRepository;

  beforeEach(() => {
    tx = {
      donation: {
        updateMany: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
    };
    prisma = { $transaction: jest.fn((fn) => fn(tx)) };
    walletsRepository = { creditDonation: jest.fn() };
    repository = new DonationsRepository(
      prisma as never,
      walletsRepository as never,
    );
  });

  const donation = () => ({
    id: 'don-1',
    userId: 'user-1',
    amount: new Decimal(10),
    transactionId: 'efi-tx-1',
    status: 'paid',
    ip: null,
  });

  it('transiciona pending → paid e credita a carteira na mesma transação', async () => {
    tx.donation.updateMany.mockResolvedValue({ count: 1 });
    const row = donation();
    tx.donation.findUniqueOrThrow.mockResolvedValue(row);

    const result = await repository.processDonation({
      donationId: 'don-1',
      voiceUri: 'tts/streamer-don-1.wav',
    });

    expect(tx.donation.updateMany).toHaveBeenCalledWith({
      where: { id: 'don-1', status: { in: ['pending', 'expired'] } },
      data: expect.objectContaining({
        status: 'paid',
        voiceUrl: 'tts/streamer-don-1.wav',
      }),
    });
    expect(walletsRepository.creditDonation).toHaveBeenCalledWith(tx, row);
    expect(result).toBe(row);
  });

  it('count 0 com doação existente → DonationAlreadyProcessedError (retry idempotente)', async () => {
    tx.donation.updateMany.mockResolvedValue({ count: 0 });
    tx.donation.findUnique.mockResolvedValue(donation());

    await expect(
      repository.processDonation({ donationId: 'don-1', voiceUri: null }),
    ).rejects.toThrow(DonationAlreadyProcessedError);

    expect(walletsRepository.creditDonation).not.toHaveBeenCalled();
  });

  it('count 0 sem doação → DonationNotFoundError', async () => {
    tx.donation.updateMany.mockResolvedValue({ count: 0 });
    tx.donation.findUnique.mockResolvedValue(null);

    await expect(
      repository.processDonation({ donationId: 'inexistente', voiceUri: null }),
    ).rejects.toThrow(DonationNotFoundError);
    expect(walletsRepository.creditDonation).not.toHaveBeenCalled();
  });

  it('guarda aceita doação expired para re-processamento (webhook atrasado)', async () => {
    tx.donation.updateMany.mockResolvedValue({ count: 1 });
    const row = donation();
    tx.donation.findUniqueOrThrow.mockResolvedValue(row);

    await repository.processDonation({ donationId: 'don-1', voiceUri: null });

    expect(tx.donation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'don-1', status: { in: ['pending', 'expired'] } },
      }),
    );
  });
});

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DonationStatus, PaymentMethod } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { DonationsRepository } from 'src/infra/db/repositories/donations.repositories';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { GatewayContract } from 'src/infra/gateway/contract/gateway.contract';
import { DonationsQueueService } from 'src/infra/queues/donations/donations-queue.service';
import { RedisService } from 'src/infra/redis/redis.service';
import { DonationDto } from './dto/donation.dto';
import { DonationEntity } from './entities/donation.entity';
import { PublicUserEntity } from './entities/public-user.entity';

@Injectable()
export class DonationsService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly donationsRepository: DonationsRepository,
    private readonly gateway: GatewayContract,
    private readonly donationsQueue: DonationsQueueService,
    private readonly redisService: RedisService,
  ) {}

  async getUser(username: string) {
    const user = await this.usersRepository.findByUsernameWithConfig(username);
    const overlay = user?.widgets[0];
    const settings = user?.donationSettings;

    if (!user || !settings) {
      throw new NotFoundException('User or settings not found');
    }

    const overlayStatus = overlay
      ? await this.redisService.get(`overlay:${overlay.token}`)
      : null;

    const data = {
      name: user.name,
      username: user.username,
      profileImageUrl: user.profileImageUrl,
      overlayActive: !!overlayStatus,
      minAudioAmount: Number(settings.minAudioAmount),
      minTextAmount: Number(settings.minTextAmount),
      maxLength: settings.maxLength,
    };

    return new PublicUserEntity(data);
  }

  async donation(
    donationDto: DonationDto,
    ip: string,
  ): Promise<DonationEntity> {
    const { name, message, amount, voiceId, username } = donationDto;

    const user = await this.usersRepository.findByUsernameWithConfig(username);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const settings = user.donationSettings;

    if (!settings) {
      throw new BadRequestException('Donation settings not found');
    }

    if (message && message.length > settings.maxLength) {
      throw new BadRequestException(
        `Message exceeds maximum length of ${settings.maxLength} characters`,
      );
    }

    const amountNum = new Decimal(amount);

    if (amountNum.lt(settings.minTextAmount)) {
      throw new BadRequestException(
        `Minimum donation amount for message is R$${Number(settings.minTextAmount)}`,
      );
    }

    if (amountNum.lt(settings.minAudioAmount)) {
      throw new BadRequestException(
        `Minimum donation amount for audio is R$${Number(settings.minAudioAmount)}`,
      );
    }

    const transaction = await this.gateway.generatePix({
      amount,
    });

    if (!transaction) {
      throw new BadRequestException(
        'We were unable to create the donation, please try again.',
      );
    }

    const donation = await this.donationsRepository.create({
      name,
      messageRaw: message,
      amount,
      voiceId,
      userId: user.id,
      pix: transaction.pix,
      status: DonationStatus.pending,
      transactionId: transaction.transactionId,
      paymentMethod: PaymentMethod.pix,
      expiredAt: transaction.expiredAt,
      messageType: 'text',
      ip,
    });

    return new DonationEntity(donation);
  }

  async webhookPix(transactionId: string): Promise<void> {
    const donation =
      await this.donationsRepository.findByTransactionId(transactionId);

    if (!donation) {
      throw new NotFoundException(
        `Donation not found for txid: ${transactionId}`,
      );
    }

    if (donation.status === DonationStatus.pending) {
      await this.donationsQueue.sendDonation({ donation_id: donation.id });
    }
  }
}

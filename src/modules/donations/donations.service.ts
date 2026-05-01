import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/client';
import { DonationsRepository } from 'src/infra/db/repositories/donations.repositories';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { GatewayContract } from 'src/infra/gateway/contract/gateway.contract';
import { DonationsQueueService } from 'src/infra/queues/donations/donations-queue.service';
import { RedisService } from 'src/infra/redis/redis.service';
import { DonationSettingsService } from '../donation-settings/donation-settings.service';
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
    private readonly donationSettingsService: DonationSettingsService,
  ) {}

  async getUser(username: string) {
    const user = await this.usersRepository.findByUsername(username);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const overlayStatus = await this.redisService.get(
      `overlay:${user.overlayKey}`,
    );

    const settings = await this.donationSettingsService.getSettings(user.id);

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

    const user = await this.usersRepository.findByUsername(username);
    if (!user) throw new BadRequestException('User not found');

    const settings = await this.donationSettingsService.getSettings(user.id);

    if (message && message.length > settings.maxLength) {
      throw new BadRequestException(
        `Message exceeds maximum length of ${settings.maxLength} characters`,
      );
    }

    const amountNum = Decimal(amount);

    if (amountNum < Decimal(settings.minTextAmount)) {
      throw new BadRequestException(
        `Minimum donation amount for TTS is R$${Number(settings.minTextAmount)}`,
      );
    }

    if (voiceId && amountNum < Decimal(settings.minAudioAmount)) {
      throw new BadRequestException(
        `Minimum donation amount for audio is R$${Number(settings.minAudioAmount)}`,
      );
    }

    const donationData = await this.gateway.generatePix({
      amount,
    });

    if (!donationData) {
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
      pix: donationData.pix,
      status: 'pending',
      transactionId: donationData.transactionId,
      paymentMethod: 'pix',
      expiredAt: donationData.expiredAt,
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

    if (donation.status === 'pending') {
      await this.donationsQueue.sendDonation({ donation_id: donation.id });
    }
  }
}

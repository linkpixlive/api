import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DonationsRepository } from 'src/infra/db/repositories/donations.repositories';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { GatewayContract } from 'src/infra/gateway/contract/gateway.contract';
import { DonationsQueueService } from 'src/infra/queues/donations/donations-queue.service';
import { RedisService } from 'src/infra/redis/redis.service';
import { DonationDto } from './dto/donation.dto';
import { DonationResponseEntity } from './entities/donation-response.entity';
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
    const user = await this.usersRepository.findByUsername(username);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const overlayStatus = await this.redisService.get(
      `overlay:${user.overlay_key}`,
    );

    return new PublicUserEntity({
      name: user.name,
      username: user.username,
      profileImageUrl: user.profile_image_url,
      overlayActive: !!overlayStatus,
    });
  }

  async donation(
    donationDto: DonationDto,
    ip: string,
  ): Promise<DonationResponseEntity> {
    const { name, message, amount, voiceId, username } = donationDto;

    const user = await this.usersRepository.findByUsername(username);
    if (!user) throw new BadRequestException('User not found');

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

    return DonationResponseEntity.toResponse(donation);
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

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Redis from 'ioredis';
import { DonationsRepository } from 'src/infra/db/repositories/donations.repositories';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { GatewayContract } from 'src/infra/gateway/contract/gateway.contract';
import { DonationsQueueService } from 'src/infra/queues/donations/donations-queue.service';
import { DonationDto } from './dto/donation.dto';

@Injectable()
export class DonationsService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly donationsRepository: DonationsRepository,
    private readonly gateway: GatewayContract,
    private readonly donationsQueue: DonationsQueueService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async getUser(username: string) {
    const user = await this.usersRepository.getBy({ username });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const overlayStatus = await this.redis.get(`overlay:${user.overlay_key}`);

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      avatar: user.profile_image_url,
      overlayActive: !!overlayStatus,
    };
  }

  async donation(donationDto: DonationDto, ip: string) {
    const { name, message, amount, voice_id, user_id } = donationDto;

    const user = await this.usersRepository.getBy({ id: user_id });
    if (!user) throw new BadRequestException('User not found');

    const { pix, transactionId, expiredAt } = await this.gateway.generatePix({
      amount,
    });

    if (!pix) {
      throw new BadRequestException(
        'We were unable to create the donation, please try again.',
      );
    }

    const donation = await this.donationsRepository.create({
      data: {
        name,
        message_raw: message,
        amount,
        voice_id,
        user_id: user.id,
        pix,
        status: 'pending',
        transaction_id: transactionId,
        payment_method: 'pix',
        expired_at: expiredAt,
        message_type: 'text',
        ip,
      },
    });

    return donation;
  }

  async webhookPix(transactionId: string): Promise<void> {
    const donation = await this.donationsRepository.getBy({
      transaction_id: transactionId,
    });

    if (!donation) {
      throw new NotFoundException(
        `Donation not found for txid: ${transactionId}`,
      );
    }

    try {
      if (donation.status === 'pending') {
        await this.donationsQueue.sendDonation({ donation_id: donation.id });
      }
    } catch (error) {
      console.error(error);
    }
  }
}

import {
  Body,
  Controller,
  Get,
  Inject,
  Ip,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import Redis from 'ioredis';
import { Public } from 'src/common/decorators/isPublic';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { DonationsService } from './donations.service';
import { DonationDto } from './dto/donation.dto';
import { WebhookPixResponseDto } from './dto/webhook-pix-response.dto';

@Public()
@Controller()
export class DonationsController {
  constructor(
    private readonly donationsService: DonationsService,
    private readonly usersRepository: UsersRepository,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  @Get('/user/:username')
  async getUser(@Param('username') username: string) {
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

  @Post('donation')
  donation(@Body() donationDto: DonationDto, @Ip() ip: string) {
    return this.donationsService.donation(donationDto, ip);
  }

  @Post('webhook/pix')
  async webhookPix(@Body() body: { pix: WebhookPixResponseDto[] }) {
    const transactions = body.pix || [];

    for (const transaction of transactions) {
      await this.donationsService.webhookPix(transaction.txid);
    }

    return 'ok';
  }
}

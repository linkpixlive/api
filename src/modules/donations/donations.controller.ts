import { Body, Controller, Get, Ip, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from 'src/common/decorators/isPublic';
import { DonationsService } from './donations.service';
import { DonationDto } from './dto/donation.dto';
import { WebhookPixResponseDto } from './dto/webhook-pix-response.dto';

@Public()
@Controller()
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  @Get('/user/:username')
  async getUser(@Param('username') username: string) {
    return this.donationsService.getUser(username);
  }

  @Post('donation')
  @Throttle({
    burst: { limit: 2, ttl: 10000 },
    donation_create: { limit: 15, ttl: 3600000 },
  })
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

import { Body, Controller, Ip, Post } from '@nestjs/common';
import { Public } from 'src/common/decorators/isPublic';
import { DonationsService } from './donations.service';
import { DonationDto } from './dto/donation.dto';
import { WebhookPixResponseDto } from './dto/webhook-pix-response.dto';

@Public()
@Controller()
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

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

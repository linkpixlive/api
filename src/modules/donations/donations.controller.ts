import { Body, Controller, Ip, Post } from '@nestjs/common';
import { Public } from 'src/common/decorators/isPublic';
import { DonationsService } from './donations.service';
import { DonationDto } from './dto/donation.dto';

@Public()
@Controller()
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  @Post('donation')
  donation(@Body() donationDto: DonationDto, @Ip() ip: string) {
    return this.donationsService.donation(donationDto, ip);
  }
}

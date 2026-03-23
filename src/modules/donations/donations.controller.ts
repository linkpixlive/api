import { Body, Controller, Get, Ip, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Get public user information' })
  @ApiResponse({
    status: 200,
    description: 'User information received successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getUser(@Param('username') username: string) {
    return this.donationsService.getUser(username);
  }

  @Post('donation')
  @ApiOperation({ summary: 'Create a new donation' })
  @ApiResponse({
    status: 201,
    description:
      'Donation created, returns Pix code and donation informations.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data (amount, user_id, voice_id...)',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests (Rate Limited).',
  })
  @Throttle({
    burst: { limit: 2, ttl: 10000 },
    donation_create: { limit: 15, ttl: 3600000 },
  })
  donation(@Body() donationDto: DonationDto, @Ip() ip: string) {
    return this.donationsService.donation(donationDto, ip);
  }

  @Post('webhook/pix')
  @ApiOperation({
    summary:
      'Pix webhook is activated when a payment update is identified in the gateway.',
  })
  @ApiResponse({
    status: 201,
    description: 'Webhook received successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data',
  })
  async webhookPix(@Body() body: { pix: WebhookPixResponseDto[] }) {
    const transactions = body.pix || [];

    for (const transaction of transactions) {
      await this.donationsService.webhookPix(transaction.txid);
    }

    return 'ok';
  }
}

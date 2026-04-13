import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from 'src/common/decorators/isPublic';
import { DonationsService } from './donations.service';
import { DonationDto } from './dto/donation.dto';
import { WebhookPixResponseDto } from './dto/webhook-pix-response.dto';

@Public()
@Controller()
export class DonationsController {
  constructor(
    private readonly donationsService: DonationsService,
    private readonly configService: ConfigService,
  ) {}

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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Pix webhook is activated when a payment update is identified in the gateway.',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook received successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (invalid HMAC)',
  })
  async webhookPix(
    @Query('hmac') hmac: string,
    @Body() body: { pix: WebhookPixResponseDto[] },
  ) {
    const secret = this.configService.get<string>('EFI_WEBHOOK_SECRET');

    if (hmac !== secret) {
      throw new UnauthorizedException('Invalid HMAC secret');
    }

    const transactions = body.pix || [];

    for (const transaction of transactions) {
      await this.donationsService.webhookPix(transaction.txid);
    }

    return 'ok';
  }
}

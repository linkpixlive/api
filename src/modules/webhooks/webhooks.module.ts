import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DonationsModule } from '../donations/donations.module';
import { WithdrawalsModule } from '../withdrawals/withdrawals.module';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [DonationsModule, WithdrawalsModule, ConfigModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}

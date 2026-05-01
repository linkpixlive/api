import { Module } from '@nestjs/common';
import { DbModule } from 'src/infra/db/db.module';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { GatewayModule } from 'src/infra/gateway/gateway.module';
import { DonationsQueueModule } from 'src/infra/queues/donations/donations-queue.module';
import { RedisModule } from 'src/infra/redis/redis.module';
import { OverlayGateway } from 'src/infra/websocket/overlay.gateway';
import { DonationSettingsModule } from '../donation-settings/donation-settings.module';
import { DonationsController } from './donations.controller';
import { DonationsService } from './donations.service';

@Module({
  imports: [
    GatewayModule,
    DbModule,
    DonationsQueueModule,
    RedisModule,
    DonationSettingsModule,
  ],
  controllers: [DonationsController],
  providers: [DonationsService, UsersRepository, OverlayGateway],
  exports: [OverlayGateway],
})
export class DonationsModule {}

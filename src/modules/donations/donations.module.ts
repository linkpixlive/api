import { Module } from '@nestjs/common';
import { DbModule } from 'src/infra/db/db.module';
import { GatewayModule } from 'src/infra/gateway/gateway.module';
import { DonationsQueueModule } from 'src/infra/queues/donations/donations-queue.module';
import { RedisModule } from 'src/infra/redis/redis.module';
import { OverlayGateway } from 'src/infra/websocket/overlay.gateway';
import { DonationsController } from './donations.controller';
import { DonationsService } from './donations.service';

@Module({
  imports: [GatewayModule, DbModule, DonationsQueueModule, RedisModule],
  controllers: [DonationsController],
  providers: [DonationsService, OverlayGateway],
  exports: [OverlayGateway],
})
export class DonationsModule {}

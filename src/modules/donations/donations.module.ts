import { Module } from '@nestjs/common';
import { DbModule } from 'src/infra/db/db.module';
import { GatewayModule } from 'src/infra/gateway/gateway.module';
import { DonationsQueueModule } from 'src/infra/queues/donations/donations-queue.module';
import { WebsocketModule } from 'src/infra/websocket/websocket.module';
import { DonationsController } from './donations.controller';
import { DonationsService } from './donations.service';

@Module({
  imports: [GatewayModule, DbModule, DonationsQueueModule, WebsocketModule],
  controllers: [DonationsController],
  providers: [DonationsService],
  exports: [DonationsService],
})
export class DonationsModule {}

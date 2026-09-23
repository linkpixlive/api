import { Module } from '@nestjs/common';
import { AiModule } from 'src/infra/ai/ai.module';
import { DbModule } from 'src/infra/db/db.module';
import { GatewayModule } from 'src/infra/gateway/gateway.module';
import { DonationsQueueModule } from 'src/infra/queues/donations/donations-queue.module';
import { StorageModule } from 'src/infra/storage/storage.module';
import { WebsocketModule } from 'src/infra/websocket/websocket.module';
import { DonationsController } from './donations.controller';
import { DonationsService } from './donations.service';

@Module({
  imports: [
    AiModule,
    GatewayModule,
    DbModule,
    DonationsQueueModule,
    StorageModule,
    WebsocketModule,
  ],
  controllers: [DonationsController],
  providers: [DonationsService],
  exports: [DonationsService],
})
export class DonationsModule {}

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AiModule } from 'src/infra/ai/ai.module';
import { GatewayModule } from 'src/infra/gateway/gateway.module';
import { SpeechModule } from 'src/infra/speech/speech.module';
import { StorageModule } from 'src/infra/storage/storage.module';
import { WebsocketModule } from 'src/infra/websocket/websocket.module';
import { VoicesModule } from 'src/modules/voices/voices.module';
import { WidgetsModule } from 'src/modules/widgets/widgets.module';
import { DonationsQueueProcessor } from './donations-queue.processor';
import { DonationsQueueService } from './donations-queue.service';

@Module({
  imports: [
    GatewayModule,
    AiModule,
    StorageModule,
    SpeechModule,
    WebsocketModule,
    WidgetsModule,
    VoicesModule,
    BullModule.registerQueue({
      name: 'donations-queue',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    }),
  ],
  providers: [DonationsQueueService, DonationsQueueProcessor],
  exports: [DonationsQueueService],
})
export class DonationsQueueModule {}

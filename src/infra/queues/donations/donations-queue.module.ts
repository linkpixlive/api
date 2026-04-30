import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from 'src/infra/ai/ai.module';
import { DonationsRepository } from 'src/infra/db/repositories/donations.repositories';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { GatewayModule } from 'src/infra/gateway/gateway.module';
import { SpeechModule } from 'src/infra/speech/speech.module';
import { StorageModule } from 'src/infra/storage/storage.module';
import { WebsocketModule } from 'src/infra/websocket/websocket.module';
import { WidgetsModule } from 'src/modules/widgets/widgets.module';
import { DonationsQueueProcessor } from './donations-queue.processor';
import { DonationsQueueService } from './donations-queue.service';

@Module({
  imports: [
    GatewayModule,
    AiModule,
    StorageModule,
    SpeechModule,
    ConfigModule,
    WebsocketModule,
    WidgetsModule,
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
  providers: [
    DonationsQueueService,
    DonationsQueueProcessor,
    DonationsRepository,
    UsersRepository,
  ],
  exports: [DonationsQueueService],
})
export class DonationsQueueModule {}

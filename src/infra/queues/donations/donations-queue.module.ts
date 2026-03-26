import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from 'src/infra/ai/ai.module';
import { DonationsRepository } from 'src/infra/db/repositories/donations.repositories';
import { TransactionsRepository } from 'src/infra/db/repositories/transactions.reposiitories';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { GatewayModule } from 'src/infra/gateway/gateway.module';
import { SpeechModule } from 'src/infra/speech/speech.module';
import { StorageModule } from 'src/infra/storage/storage.module';
import { OverlayGateway } from 'src/infra/websocket/overlay.gateway';
import { DonationsQueueProcessor } from './donations-queue.processor';
import { DonationsQueueService } from './donations-queue.service';

@Module({
  imports: [
    GatewayModule,
    AiModule,
    StorageModule,
    SpeechModule,
    ConfigModule,
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
    OverlayGateway,
    TransactionsRepository,
  ],
  exports: [DonationsQueueService],
})
export class DonationsQueueModule {}

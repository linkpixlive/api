import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EmailProcessor } from './email.processor';
import { EmailService } from './email.service';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: 'email-queue',
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
    {
      provide: 'RESEND_CLIENT',
      useFactory: (configService: ConfigService) => {
        return new Resend(configService.get<string>('RESEND_API_KEY'));
      },
      inject: [ConfigService],
    },
    EmailService,
    EmailProcessor,
  ],
  exports: [EmailService],
})
export class EmailModule {}

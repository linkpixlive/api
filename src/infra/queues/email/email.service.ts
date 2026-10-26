import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Email } from './email.type';

@Injectable()
export class EmailService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EmailService.name);

  constructor(@InjectQueue('email-queue') private emailQueue: Queue) {}

  onApplicationBootstrap() {
    this.emailQueue.on('error', (err) =>
      this.logger.error(`email-queue: ${err.message}`),
    );
  }

  async sendEmail(data: Email) {
    await this.emailQueue.add('send-email', data);
  }
}

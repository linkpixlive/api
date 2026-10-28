import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import { wake } from '../sleep-on-idle';
import { EmailProcessor } from './email.processor';
import { Email } from './email.type';

@Injectable()
export class EmailService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @InjectQueue('email-queue') private emailQueue: Queue,
    private readonly emailProcessor: EmailProcessor,
  ) {}

  onApplicationBootstrap() {
    this.emailQueue.on('error', (err) =>
      this.logger.error(`email-queue: ${err.message}`),
    );
  }

  async sendEmail(data: Email) {
    wake(this.emailProcessor.worker);
    await this.emailQueue.add('send-email', data);
  }
}

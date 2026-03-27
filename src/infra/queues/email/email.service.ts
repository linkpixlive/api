import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Email } from './email.type';

@Injectable()
export class EmailService {
  constructor(@InjectQueue('email-queue') private emailQueue: Queue) {}

  async sendEmail(data: Email) {
    await this.emailQueue.add('send-email', data);
  }
}

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class EmailService {
  constructor(@InjectQueue('email-queue') private emailQueue: Queue) {}

  async sendEmail(data: any) {
    await this.emailQueue.add('send-email', data);
  }
}

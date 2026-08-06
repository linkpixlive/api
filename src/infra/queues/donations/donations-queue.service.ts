import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class DonationsQueueService {
  constructor(@InjectQueue('donations-queue') private donationsQueue: Queue) {}

  async sendDonation(data: { donation_id: string }) {
    await this.donationsQueue.add('send-donation', data);
  }
}

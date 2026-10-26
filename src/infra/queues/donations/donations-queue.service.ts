import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class DonationsQueueService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DonationsQueueService.name);

  constructor(@InjectQueue('donations-queue') private donationsQueue: Queue) {}

  onApplicationBootstrap() {
    this.donationsQueue.on('error', (err) =>
      this.logger.error(`donations-queue: ${err.message}`),
    );
  }

  async sendDonation(data: { donation_id: string }) {
    const jobId = data.donation_id;
    const existing = await this.donationsQueue.getJob(jobId);

    if (existing) {
      if ((await existing.getState()) === 'failed') {
        await existing.retry();
      }
      return;
    }

    await this.donationsQueue.add('send-donation', data, {
      jobId,
      attempts: 4,
      backoff: { type: 'exponential', delay: 30_000 },
    });
  }
}

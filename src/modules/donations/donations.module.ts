import { Module } from '@nestjs/common';
import { DbModule } from 'src/infra/db/db.module';
import { GatewayModule } from 'src/infra/gateway/gateway.module';
import { DonationsController } from './donations.controller';
import { DonationsService } from './donations.service';
import { DonationsQueueModule } from 'src/infra/queues/donations/donations-queue.module';

@Module({
  imports: [GatewayModule, DbModule, DonationsQueueModule],
  controllers: [DonationsController],
  providers: [DonationsService],
})
export class DonationsModule {}

import { Module } from '@nestjs/common';
import { GatewayModule } from 'src/infra/gateway/gateway.module';
import { DonationsController } from './donations.controller';
import { DonationsService } from './donations.service';

@Module({
  imports: [GatewayModule],
  controllers: [DonationsController],
  providers: [DonationsService],
})
export class DonationsModule {}

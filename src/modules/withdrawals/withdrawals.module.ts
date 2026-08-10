import { Module } from '@nestjs/common';
import { GatewayModule } from '../../infra/gateway/gateway.module';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsSchedulerService } from './withdrawals-scheduler.service';
import { WithdrawalsService } from './withdrawals.service';

@Module({
  imports: [GatewayModule],
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService, WithdrawalsSchedulerService],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}

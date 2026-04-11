import { Module } from '@nestjs/common';
import { SecurityService } from '../../common/security/security.service';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsService } from './withdrawals.service';

@Module({
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService, SecurityService],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}

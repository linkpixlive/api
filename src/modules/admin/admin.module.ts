import { Module } from '@nestjs/common';
import { WithdrawalsModule } from '../withdrawals/withdrawals.module';
import { WithdrawalsAdminController } from './withdrawals-admin.controller';

@Module({
  imports: [WithdrawalsModule],
  controllers: [WithdrawalsAdminController],
})
export class AdminModule {}

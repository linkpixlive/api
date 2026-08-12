import { Module } from '@nestjs/common';
import { WalletsController } from './wallets.controller';
import { WalletsSchedulerService } from './wallets-scheduler.service';
import { WalletsService } from './wallets.service';

@Module({
  controllers: [WalletsController],
  providers: [WalletsService, WalletsSchedulerService],
})
export class WalletsModule {}

import { Module } from '@nestjs/common';
import { DbModule } from 'src/infra/db/db.module';
import { DonationSettingsController } from './donation-settings.controller';
import { DonationSettingsService } from './donation-settings.service';

@Module({
  imports: [DbModule],
  controllers: [DonationSettingsController],
  providers: [DonationSettingsService],
  exports: [DonationSettingsService],
})
export class DonationSettingsModule {}

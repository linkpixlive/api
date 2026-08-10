import { Module } from '@nestjs/common';
import { SecurityService } from 'src/common/security/security.service';
import { AuthModule } from '../auth/auth.module';
import { AccountSettingsController } from './account-settings.controller';
import { AccountSettingsService } from './account-settings.service';

@Module({
  imports: [AuthModule],
  controllers: [AccountSettingsController],
  providers: [AccountSettingsService, SecurityService],
})
export class AccountSettingsModule {}

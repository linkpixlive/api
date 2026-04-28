import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ChangePasswordRepository } from './repositories/change-password.repositories';
import { DashboardRepository } from './repositories/dashboard.repositories';
import { DonationsRepository } from './repositories/donations.repositories';
import { PixKeysRepository } from './repositories/pix-keys.repositories';
import { UsersRepository } from './repositories/users.repositories';
import { WalletsRepository } from './repositories/wallets.repositories';
import { WithdrawalsRepository } from './repositories/withdrawals.repositories';
import { DonationSettingsRepository } from './repositories/donation-settings.repositories';
import { WidgetRepository } from './repositories/widget.repositories';

@Global()
@Module({
  providers: [
    PrismaService,
    UsersRepository,
    ChangePasswordRepository,
    DashboardRepository,
    DonationsRepository,
    PixKeysRepository,
    WalletsRepository,
    WithdrawalsRepository,
    DonationSettingsRepository,
    WidgetRepository,
  ],
  exports: [
    PrismaService,
    UsersRepository,
    ChangePasswordRepository,
    DashboardRepository,
    DonationsRepository,
    PixKeysRepository,
    WalletsRepository,
    WithdrawalsRepository,
    DonationSettingsRepository,
    WidgetRepository,
  ],
})
export class DbModule {}

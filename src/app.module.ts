import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './common/db/db.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DonationsModule } from './modules/donations/donations.module';
import { WithdrawalsModule } from './modules/withdrawals/withdrawals.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    DashboardModule,
    DonationsModule,
    WithdrawalsModule,
    DbModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

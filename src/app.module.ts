import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './common/db/db.module';
import { SecurityModule } from './common/security/security.module';
import { EmailModule } from './infra/email/email.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DonationsModule } from './modules/donations/donations.module';
import { WithdrawalsModule } from './modules/withdrawals/withdrawals.module';
import { GatewayModule } from './infra/gateway/gateway.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
      },
    }),
    AuthModule,
    DashboardModule,
    DonationsModule,
    WithdrawalsModule,
    DbModule,
    SecurityModule,
    EmailModule,
    HttpModule,
    GatewayModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SecurityModule } from './common/security/security.module';
import { AiModule } from './infra/ai/ai.module';
import { DbModule } from './infra/db/db.module';
import { GatewayModule } from './infra/gateway/gateway.module';
import { EmailModule } from './infra/queues/email/email.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DonationsModule } from './modules/donations/donations.module';
import { WithdrawalsModule } from './modules/withdrawals/withdrawals.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
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
    AiModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './common/config/env.validation';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { SecurityModule } from './common/security/security.module';
import { AiModule } from './infra/ai/ai.module';
import { DbModule } from './infra/db/db.module';
import { GatewayModule } from './infra/gateway/gateway.module';
import { EmailModule } from './infra/queues/email/email.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DonationsModule } from './modules/donations/donations.module';
import { PixKeysModule } from './modules/pix-keys/pix-keys.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { WithdrawalsModule } from './modules/withdrawals/withdrawals.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'burst',
          ttl: 1000,
          limit: 5,
        },
        {
          name: 'standard',
          ttl: 60000,
          limit: 45,
        },
        {
          name: 'long_term',
          ttl: 3600000,
          limit: 500,
        },
      ],
      storage: new ThrottlerStorageRedisService(process.env.REDIS_URL),
    }),
    AuthModule,
    DashboardModule,
    DonationsModule,
    PixKeysModule,
    WalletsModule,
    WithdrawalsModule,
    DbModule,
    SecurityModule,
    EmailModule,
    HttpModule,
    GatewayModule,
    AiModule,
    AdminModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validate } from './common/config/env.validation';
import { SecurityModule } from './common/security/security.module';
import { AiModule } from './infra/ai/ai.module';
import { DbModule } from './infra/db/db.module';
import { GatewayModule } from './infra/gateway/gateway.module';
import { EmailModule } from './infra/queues/email/email.module';
import { RedisModule } from './infra/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DonationsModule } from './modules/donations/donations.module';
import { PixKeysModule } from './modules/pix-keys/pix-keys.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { WithdrawalsModule } from './modules/withdrawals/withdrawals.module';
import { AdminModule } from './modules/admin/admin.module';
import { WidgetsModule } from './modules/widgets/widgets.module';
import { DonationSettingsModule } from './modules/donation-settings/donation-settings.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { ProfileModule } from './modules/profile/profile.module';
import { VoicesModule } from './modules/voices/voices.module';
import { AccountSettingsModule } from './modules/account-settings/account-settings.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
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
        {
          name: 'login_limit',
          ttl: 300000,
          limit: 10,
        },
        {
          name: 'registration_limit',
          ttl: 900000,
          limit: 3,
        },
        {
          name: 'recovery_limit',
          ttl: 900000,
          limit: 4,
        },
        {
          name: 'email_change_limit',
          ttl: 900000,
          limit: 3,
        },
        {
          name: 'password_change_limit',
          ttl: 900000,
          limit: 3,
        },
        {
          name: '2fa_limit',
          ttl: 300000,
          limit: 5,
        },
        {
          name: 'deactivation_limit',
          ttl: 900000,
          limit: 3,
        },
        {
          name: 'ws_alert_finished',
          ttl: 20000,
          limit: 8,
        },
        {
          name: 'ws_heartbeat',
          ttl: 60000,
          limit: 5,
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
    RedisModule,
    SecurityModule,
    EmailModule,
    HttpModule,
    GatewayModule,
    AiModule,
    AdminModule,
    WidgetsModule,
    DonationSettingsModule,
    WebhooksModule,
    ProfileModule,
    VoicesModule,
    AccountSettingsModule,
    HealthModule,
  ],
  controllers: [],
  providers: [
    ...(process.env.NODE_ENV !== 'development'
      ? [{ provide: APP_GUARD, useClass: ThrottlerGuard }]
      : []),
  ],
})
export class AppModule {}

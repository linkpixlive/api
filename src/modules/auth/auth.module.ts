import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { SecurityService } from 'src/common/security/security.service';
import { EmailModule } from 'src/infra/queues/email/email.module';
import { AuthCleanupService } from './auth-cleanup.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { VerificationService } from './verification.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        global: true,
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: `${configService.getOrThrow('JWT_EXPIRES_IN_DAYS')}d`,
        },
      }),
    }),
    EmailModule,
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthCleanupService,
    VerificationService,
    SecurityService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [VerificationService],
})
export class AuthModule {}

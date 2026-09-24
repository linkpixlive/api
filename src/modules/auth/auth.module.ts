import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EmailModule } from 'src/infra/queues/email/email.module';
import { AuthCleanupService } from './auth-cleanup.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ProfileModule } from '../profile/profile.module';
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
    ProfileModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthCleanupService, VerificationService],
  exports: [AuthService, VerificationService],
})
export class AuthModule {}

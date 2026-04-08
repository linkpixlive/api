import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ChangePasswordRepository } from './repositories/change-password.repositorites';
import { DonationsRepository } from './repositories/donations.repositories';
import { PixKeysRepository } from './repositories/pix-keys.repositories';
import { UsersRepository } from './repositories/users.repositories';
import { WalletsRepository } from './repositories/wallets.repositories';
import { WithdrawalsRepository } from './repositories/withdrawals.repositories';

@Global()
@Module({
  providers: [
    PrismaService,
    UsersRepository,
    ChangePasswordRepository,
    DonationsRepository,
    PixKeysRepository,
    WalletsRepository,
    WithdrawalsRepository,
  ],
  exports: [
    PrismaService,
    UsersRepository,
    ChangePasswordRepository,
    DonationsRepository,
    PixKeysRepository,
    WalletsRepository,
    WithdrawalsRepository,
  ],
})
export class DbModule {}

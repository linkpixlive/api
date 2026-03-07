import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ChangePasswordRepository } from './repositories/change-password.repositorites';
import { DonationsRepository } from './repositories/donations.repositories';
import { UsersRepository } from './repositories/users.repositories';

@Global()
@Module({
  providers: [
    PrismaService,
    UsersRepository,
    ChangePasswordRepository,
    DonationsRepository,
  ],
  exports: [
    PrismaService,
    UsersRepository,
    ChangePasswordRepository,
    DonationsRepository,
  ],
})
export class DbModule {}

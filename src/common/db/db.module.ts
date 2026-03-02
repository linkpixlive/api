import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ChangePasswordRepository } from './repositories/change-password.repositorites';
import { UsersRepository } from './repositories/users.repositories';

@Global()
@Module({
  providers: [PrismaService, UsersRepository, ChangePasswordRepository],
  exports: [PrismaService, UsersRepository, ChangePasswordRepository],
})
export class DbModule {}

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RepositoriesResolver } from './repositories/repositories.resolver';

@Global()
@Module({
  controllers: [],
  providers: [PrismaService, RepositoriesResolver],
})
export class DbModule {}

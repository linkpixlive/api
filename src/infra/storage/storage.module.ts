import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageContract } from './contract/storage.contract';
import { R2Service } from './R2/r2.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: StorageContract,
      useClass: R2Service,
    },
  ],
  exports: [StorageContract],
})
export class StorageModule {}

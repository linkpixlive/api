import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GatewayResponseRepository } from '../db/repositories/gateway-response.repositories';
import { EfiService } from './Efi/efi.service';
import { GatewayContract } from './contract/gateway.contract';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [
    GatewayResponseRepository,
    {
      provide: GatewayContract,
      useClass: EfiService,
    },
  ],
  exports: [GatewayContract],
})
export class GatewayModule {}

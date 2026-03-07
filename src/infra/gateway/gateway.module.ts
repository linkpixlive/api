import { Module } from '@nestjs/common';
import { GatewayService } from './gateway.service';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [GatewayService],
  exports: [GatewayService],
})
export class GatewayModule {}

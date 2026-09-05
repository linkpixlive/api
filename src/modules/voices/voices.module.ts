import { Module } from '@nestjs/common';
import { DbModule } from 'src/infra/db/db.module';
import { VoicesPublicController } from './voices.controller';
import { VoicesService } from './voices.service';

@Module({
  imports: [DbModule],
  controllers: [VoicesPublicController],
  providers: [VoicesService],
  exports: [VoicesService],
})
export class VoicesModule {}

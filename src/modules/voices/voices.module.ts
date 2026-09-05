import { Module } from '@nestjs/common';
import { DbModule } from 'src/infra/db/db.module';
import { VoicesController, VoicesPublicController } from './voices.controller';
import { VoicesService } from './voices.service';

@Module({
  imports: [DbModule],
  controllers: [VoicesController, VoicesPublicController],
  providers: [VoicesService],
  exports: [VoicesService],
})
export class VoicesModule {}

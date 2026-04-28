import { Module } from '@nestjs/common';
import { DbModule } from 'src/infra/db/db.module';
import { WebsocketModule } from 'src/infra/websocket/websocket.module';
import { WidgetsController } from './widgets.controller';
import { WidgetsService } from './widgets.service';

@Module({
  imports: [DbModule, WebsocketModule],
  controllers: [WidgetsController],
  providers: [WidgetsService],
  exports: [WidgetsService],
})
export class WidgetsModule {}

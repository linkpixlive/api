import { Module } from '@nestjs/common';
import { WidgetSettingsPipe } from 'src/common/pipes/widget-settings.pipe';
import { DbModule } from 'src/infra/db/db.module';
import { WebsocketModule } from 'src/infra/websocket/websocket.module';
import { WidgetsController } from './widgets.controller';
import { WidgetsService } from './widgets.service';

@Module({
  imports: [DbModule, WebsocketModule],
  controllers: [WidgetsController],
  providers: [WidgetsService, WidgetSettingsPipe],
  exports: [WidgetsService],
})
export class WidgetsModule {}

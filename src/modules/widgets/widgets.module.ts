import { Module, forwardRef } from '@nestjs/common';
import { WidgetSettingsPipe } from 'src/common/pipes/widget-settings.pipe';
import { DbModule } from 'src/infra/db/db.module';
import { WebsocketModule } from 'src/infra/websocket/websocket.module';
import { OverlayController } from './overlay.controller';
import { OverlayService } from './overlay.service';
import { WidgetsController } from './widgets.controller';
import { WidgetsService } from './widgets.service';

@Module({
  imports: [DbModule, forwardRef(() => WebsocketModule)],
  controllers: [WidgetsController, OverlayController],
  providers: [WidgetsService, OverlayService, WidgetSettingsPipe],
  exports: [WidgetsService, OverlayService],
})
export class WidgetsModule {}

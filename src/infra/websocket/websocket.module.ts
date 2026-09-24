import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { WidgetsModule } from 'src/modules/widgets/widgets.module';
import { DashboardGateway } from './dashboard.gateway';
import { OverlayGateway } from './overlay.gateway';

@Module({
  imports: [forwardRef(() => WidgetsModule), AuthModule],
  providers: [OverlayGateway, DashboardGateway],
  exports: [OverlayGateway, DashboardGateway],
})
export class WebsocketModule {}

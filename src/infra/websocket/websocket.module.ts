import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WidgetsModule } from 'src/modules/widgets/widgets.module';
import { DashboardGateway } from './dashboard.gateway';
import { OverlayGateway } from './overlay.gateway';

@Module({
  imports: [forwardRef(() => WidgetsModule), JwtModule],
  providers: [OverlayGateway, DashboardGateway],
  exports: [OverlayGateway, DashboardGateway],
})
export class WebsocketModule {}

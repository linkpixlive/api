import { Module } from '@nestjs/common';
import { OverlayGateway } from './overlay.gateway';

@Module({
  providers: [OverlayGateway],
  exports: [OverlayGateway],
})
export class WebsocketModule {}

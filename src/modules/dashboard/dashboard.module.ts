import { Module } from '@nestjs/common';
import { WebsocketModule } from 'src/infra/websocket/websocket.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [WebsocketModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}

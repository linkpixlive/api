import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OverlayDonationEntity } from 'src/modules/donations/entities/overlay-donation.entity';
import { DonationHistoryEntity } from 'src/modules/dashboard/entities/donation-history.entity';
import { OverlayService } from 'src/modules/widgets/overlay.service';

@Injectable()
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'dashboard',
})
export class DashboardGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => OverlayService))
    private readonly overlayService: OverlayService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth.token as string;
    if (!token) return client.disconnect();

    const payload: { sub: string } = this.jwtService.decode(token);
    if (!payload?.sub) return client.disconnect();

    client['userId'] = payload.sub;
    await client.join(payload.sub);
    await this.overlayService.emitDashboardState(payload.sub);
  }

  emitQueueSync(userId: string, queue: OverlayDonationEntity[]) {
    this.server.to(userId).emit('queue_sync', queue);
  }

  emitOverlayStatus(userId: string, online: boolean, isPaused?: boolean) {
    this.server.to(userId).emit('overlay_status', {
      online,
      ...(isPaused !== undefined && { isPaused }),
    });
  }

  emitDonationCreated(userId: string, donation: DonationHistoryEntity) {
    this.server.to(userId).emit('donation:created', donation);
  }

  emitDonationUpdated(userId: string, donation: DonationHistoryEntity) {
    this.server.to(userId).emit('donation:updated', donation);
  }
}

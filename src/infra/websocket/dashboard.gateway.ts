import {
  Inject,
  Injectable,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from 'src/modules/auth/auth.service';
import { OverlayDonationEntity } from 'src/modules/donations/entities/overlay-donation.entity';
import { DonationHistoryEntity } from 'src/modules/donations/entities/donation-history.entity';
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
    private readonly authService: AuthService,
    @Inject(forwardRef(() => OverlayService))
    private readonly overlayService: OverlayService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth.token as unknown;
    if (typeof token !== 'string' || !token) return client.disconnect();

    const session = await this.authService
      .validateSessionToken(token)
      .catch((error: unknown) => {
        if (error instanceof UnauthorizedException) {
          client.disconnect();
          return null;
        }
        throw error;
      });
    if (!session) return;

    client['userId'] = session.user.id;
    await client.join(session.user.id);
    await this.overlayService.emitDashboardState(session.user.id);
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

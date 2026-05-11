import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OverlayDonationEntity } from 'src/modules/donations/entities/overlay-donation.entity';

@Injectable()
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'dashboard',
})
export class DashboardGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth.token as string;
    if (!token) return client.disconnect();

    const payload: { sub: string } = this.jwtService.decode(token);

    client['userId'] = payload.sub;
    await client.join(payload.sub);
  }

  emitQueueSync(userId: string, queue: OverlayDonationEntity[]) {
    this.server.to(userId).emit('queue_sync', queue);
  }

  emitOverlayStatus(userId: string, online: boolean) {
    this.server.to(userId).emit('overlay_status', { online });
  }
}

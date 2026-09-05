import { Inject, forwardRef } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OverlayDonationEntity } from 'src/modules/donations/entities/overlay-donation.entity';
import { OverlayService } from 'src/modules/widgets/overlay.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'overlay',
  pingInterval: 30000,
  pingTimeout: 10000,
})
export class OverlayGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(forwardRef(() => OverlayService))
    private readonly overlayService: OverlayService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.query.token as string;
    if (!token) return client.disconnect();

    const registered = await this.overlayService.registerConnection(token);
    if (!registered) return client.disconnect();

    client['token'] = token;
    await client.join(token);
  }

  async handleDisconnect(client: Socket) {
    const token = client['token'] as string;
    if (!token) return;
    await this.overlayService.unregisterConnection(token);
  }

  @SubscribeMessage('alert_finished')
  @Throttle({ ws_alert_finished: { limit: 8, ttl: 20000 } })
  async handleAlertFinished(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { id: string },
  ) {
    const token = client['token'] as string;
    if (!token || !data?.id) return;
    await this.overlayService.alertFinished(token, data.id);
  }

  @SubscribeMessage('heartbeat_pulse')
  @Throttle({ ws_heartbeat: { limit: 5, ttl: 60000 } })
  async handlePulse(@ConnectedSocket() client: Socket) {
    const token = client['token'] as string;
    if (!token) return;
    await this.overlayService.updateOnlineStatus(token);
  }

  emitNewDonation(token: string, donation: OverlayDonationEntity) {
    this.server.to(token).emit('new_donation', donation);
  }

  emitSkipAlert(token: string) {
    this.server.to(token).emit('skip_alert');
  }

  emitPauseAlerts(token: string) {
    this.server.to(token).emit('pause_alerts');
  }

  emitResumeAlerts(token: string) {
    this.server.to(token).emit('resume_alerts');
  }

  emitClearAlerts(token: string) {
    this.server.to(token).emit('clear_alerts');
  }

  emitSettingsUpdated(token: string) {
    this.server.to(token).emit('settings_updated');
  }
}

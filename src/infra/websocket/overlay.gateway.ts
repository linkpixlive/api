import { UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OverlayDonationEntity } from 'src/modules/donations/entities/overlay-donation.entity';
import { DonationsRepository } from '../db/repositories/donations.repositories';
import { WidgetRepository } from '../db/repositories/widget.repositories';
import { RedisService } from '../redis/redis.service';

@UseGuards(ThrottlerGuard)
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'overlay',
  pingInterval: 60000,
  pingTimeout: 10000,
})
export class OverlayGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly widgetRepository: WidgetRepository,
    private readonly donationsRepository: DonationsRepository,
    private readonly redisService: RedisService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.query.token as string;

    if (!token) return client.disconnect();

    const widget = await this.widgetRepository.findByToken(token);
    if (!widget || !widget.active) return client.disconnect();

    await this.redisService.setWithExpire(`overlay:${token}`, 60, 'true');
    await client.join(token);
  }

  @SubscribeMessage('displayed_donation')
  @Throttle({ default: { limit: 4, ttl: 20000 } })
  async handleDisplayedDonation(
    client: Socket,
    @MessageBody() data: { id: string },
  ) {
    const token = client.handshake.query.token as string;
    const { id } = data;

    const [donation, widget] = await Promise.all([
      this.donationsRepository.findById(id),
      this.widgetRepository.findByToken(token),
    ]);

    if (!donation || !widget || donation.userId !== widget.userId) return;

    await this.donationsRepository.update(id, { status: 'displayed' });
  }

  @SubscribeMessage('heartbeat_pulse')
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  async handlePulse(@ConnectedSocket() client: Socket) {
    const token = client.handshake.query.token as string;
    await this.redisService.setWithExpire(`overlay:${token}`, 60, 'true');
  }

  async handleDisconnect(client: Socket) {
    const token = client.handshake.query.token as string;
    if (!token) return;

    await this.redisService.remove(`overlay:${token}`);
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

  emitTestNotification(token: string) {
    this.server.to(token).emit('test_notification', {
      name: 'LinkPix',
      message: 'Esta é uma notificação de teste!',
      amount: 8.43,
      id: 'test-id',
    });
  }
}

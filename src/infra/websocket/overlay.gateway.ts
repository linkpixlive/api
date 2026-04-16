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
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { DonationsRepository } from '../db/repositories/donations.repositories';
import { RedisService } from '../redis/redis.service';
import { OverlayDonationEntity } from 'src/modules/donations/entities/overlay-donation.entity';

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
    private readonly usersRepository: UsersRepository,
    private readonly donationsRepository: DonationsRepository,
    private readonly redisService: RedisService,
  ) {}

  async handleConnection(client: Socket) {
    const key = client.handshake.query.key as string;

    if (!key) return client.disconnect();

    const user = await this.usersRepository.findByOverlayKey(key);
    if (!user) return client.disconnect();

    await this.redisService.setWithExpire(`overlay:${key}`, 60, 'true');
    await client.join(user.overlay_key);
  }

  @SubscribeMessage('displayed_donation')
  @Throttle({ default: { limit: 4, ttl: 20000 } })
  async handleDisplayedDonation(
    client: Socket,
    @MessageBody() data: { id: string },
  ) {
    const key = client.handshake.query.key as string;
    const { id } = data;

    const [donation, user] = await Promise.all([
      this.donationsRepository.findById(id),
      this.usersRepository.findByOverlayKey(key),
    ]);

    if (!donation || !user || donation.user_id !== user.id) return;

    await this.donationsRepository.update(id, { status: 'displayed' });
  }

  @SubscribeMessage('heartbeat_pulse')
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  async handlePulse(@ConnectedSocket() client: Socket) {
    const key = client.handshake.query.key as string;
    await this.redisService.setWithExpire(`overlay:${key}`, 60, 'true');
  }

  async handleDisconnect(client: Socket) {
    const key = client.handshake.query.key as string;
    if (!key) return;

    await this.redisService.remove(`overlay:${key}`);
  }

  emitNewDonation(overlayKey: string, donation: OverlayDonationEntity) {
    this.server.to(overlayKey).emit('new_donation', donation);
  }

  emitSkipAlert(overlayKey: string) {
    this.server.to(overlayKey).emit('skip_alert');
  }

  emitPauseAlerts(overlayKey: string) {
    this.server.to(overlayKey).emit('pause_alerts');
  }

  emitResumeAlerts(overlayKey: string) {
    this.server.to(overlayKey).emit('resume_alerts');
  }

  emitClearAlerts(overlayKey: string) {
    this.server.to(overlayKey).emit('clear_alerts');
  }
}

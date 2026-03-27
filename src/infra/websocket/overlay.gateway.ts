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

    const user = await this.usersRepository.getBy({ overlay_key: key });
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
    const { id } = data;

    const donation = await this.donationsRepository.getBy({ id });
    if (!donation) return;

    await this.donationsRepository.update({
      where: { id },
      data: { status: 'displayed' },
    });
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
}

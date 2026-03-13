import { Inject } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import Redis from 'ioredis';
import { Server, Socket } from 'socket.io';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { DonationsRepository } from '../db/repositories/donations.repositories';

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
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async handleConnection(client: Socket) {
    const key = client.handshake.query.key as string;

    if (!key) return client.disconnect();

    const user = await this.usersRepository.getBy({ overlay_key: key });
    if (!user) return client.disconnect();

    await this.redis.set(`overlay:${key}`, 'true', 'EX', 60);
    await client.join(user.overlay_key);
  }

  @SubscribeMessage('displayed_donation')
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
  async handlePulse(@ConnectedSocket() client: Socket) {
    const key = client.handshake.query.key as string;
    await this.redis.expire(`overlay:${key}`, 60);
  }

  async handleDisconnect(client: Socket) {
    const key = client.handshake.query.key as string;
    if (!key) return;

    await this.redis.del(`overlay:${key}`);
  }
}

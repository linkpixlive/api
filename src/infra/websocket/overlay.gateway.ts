import {
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { DonationsRepository } from '../db/repositories/donations.repositories';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'overlay',
})
export class OverlayGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly donationsRepository: DonationsRepository,
  ) {}

  async handleConnection(client: Socket) {
    const key = client.handshake.query.key as string;

    if (!key) return client.disconnect();

    const user = await this.usersRepository.getBy({ overlay_key: key });
    if (!user) return client.disconnect();

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
}

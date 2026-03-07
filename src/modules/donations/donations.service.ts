import { BadRequestException, Injectable } from '@nestjs/common';
import { DonationsRepository } from 'src/common/db/repositories/donations.repositories';
import { UsersRepository } from 'src/common/db/repositories/users.repositories';
import { GatewayService } from 'src/infra/gateway/gateway.service';
import { DonationDto } from './dto/donation.dto';

@Injectable()
export class DonationsService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly donationsRepository: DonationsRepository,
    private readonly gatewayService: GatewayService,
  ) {}

  async donation(donationDto: DonationDto, ip: string) {
    const { name, message, amount, voice_id, user_id } = donationDto;

    const user = await this.usersRepository.getBy({ id: user_id });
    if (!user) throw new BadRequestException('User not found');

    const { pix, transactionId, expiredAt } =
      await this.gatewayService.generatePix({ amount });

    if (!pix) {
      throw new BadRequestException(
        'We were unable to create the donation, please try again.',
      );
    }

    const donation = await this.donationsRepository.create({
      data: {
        name,
        message,
        amount,
        voice_id,
        user_id: user.id,
        pix,
        status: 'pending',
        transaction_id: transactionId,
        payment_method: 'pix',
        expired_at: expiredAt,
        message_type: 'text',
        ip,
      },
    });

    return donation;
  }
}

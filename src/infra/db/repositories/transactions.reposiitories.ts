import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ProcessDonationParams } from './dto/transactions.dto';

@Injectable()
export class TransactionsRepository {
  constructor(private prismaService: PrismaService) {}

  async processDonation({
    donationId,
    message,
    voiceUri,
  }: ProcessDonationParams) {
    return await this.prismaService.$transaction(async (tx) => {
      const updatedDonation = await tx.donation.update({
        where: { id: donationId },
        data: {
          status: 'paid',
          message: message,
          approved_at: new Date(),
          voice_url: voiceUri,
        },
      });

      const wallet = await tx.wallet.update({
        where: { user_id: updatedDonation.user_id },
        data: {
          current_balance: {
            increment: updatedDonation.amount,
          },
          last_transaction_id: updatedDonation.transaction_id,
          updated_at: new Date(),
        },
      });

      await tx.transaction.create({
        data: {
          donation_id: updatedDonation.id,
          amount: updatedDonation.amount,
          balance_after: wallet.current_balance,
          type: 'donation',
          ip: updatedDonation.ip,
          transaction_id: updatedDonation.transaction_id,
          user_id: updatedDonation.user_id,
        },
      });

      return updatedDonation;
    });
  }
}

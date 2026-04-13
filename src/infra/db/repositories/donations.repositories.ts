import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CreateDonationParams,
  UpdateDonationParams,
} from './dto/donations.dto';
import { ProcessDonationParams } from './dto/transactions.dto';

@Injectable()
export class DonationsRepository {
  constructor(private prismaService: PrismaService) {}

  async processDonation({
    donationId,
    message,
    voiceUri,
  }: ProcessDonationParams) {
    return await this.prismaService.$transaction(async (tx) => {
      const donation = await tx.donation.findUnique({
        where: { id: donationId },
      });

      if (!donation || donation.status !== 'pending') {
        throw new BadRequestException(
          'Donation already processed or not found',
        );
      }

      const updateResult = await tx.donation.updateMany({
        where: { id: donationId, status: 'pending' },
        data: {
          status: 'paid',
          message: message,
          approved_at: new Date(),
          voice_url: voiceUri,
        },
      });

      if (updateResult.count === 0) {
        throw new BadRequestException('Donation already processed');
      }

      const updatedDonation = await tx.donation.findUniqueOrThrow({
        where: { id: donationId },
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

  async create(data: CreateDonationParams) {
    return await this.prismaService.donation.create({
      data: {
        user_id: data.userId,
        name: data.name,
        amount: data.amount,
        transaction_id: data.transactionId,
        payment_method: data.paymentMethod,
        ip: data.ip,
        message_raw: data.messageRaw,
        voice_id: data.voiceId,
        pix: data.pix,
        status: data.status,
        expired_at: data.expiredAt,
        approved_at: data.approvedAt,
        message_type: data.messageType,
        message: data.message,
        voice_url: data.voiceUrl,
      },
    });
  }

  async findById(id: string) {
    return await this.prismaService.donation.findUnique({ where: { id } });
  }

  async findByTransactionId(transactionId: string) {
    return await this.prismaService.donation.findUnique({
      where: { transaction_id: transactionId },
    });
  }

  async update(id: string, data: UpdateDonationParams) {
    return await this.prismaService.donation.update({
      where: { id },
      data: {
        name: data.name,
        amount: data.amount,
        ip: data.ip,
        message_raw: data.messageRaw,
        voice_id: data.voiceId,
        pix: data.pix,
        status: data.status,
        expired_at: data.expiredAt,
        approved_at: data.approvedAt,
        payment_method: data.paymentMethod,
        transaction_id: data.transactionId,
        message_type: data.messageType,
        message: data.message,
        voice_url: data.voiceUrl,
      },
    });
  }
}

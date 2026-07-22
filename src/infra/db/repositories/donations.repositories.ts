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
          'Doação já processada ou não encontrada',
        );
      }

      const updateResult = await tx.donation.updateMany({
        where: { id: donationId, status: 'pending' },
        data: {
          status: 'paid',
          message: message,
          approvedAt: new Date(),
          voiceUrl: voiceUri,
        },
      });

      if (updateResult.count === 0) {
        throw new BadRequestException('Doação já processada');
      }

      const updatedDonation = await tx.donation.findUniqueOrThrow({
        where: { id: donationId },
      });

      const wallet = await tx.wallet.update({
        where: { userId: updatedDonation.userId },
        data: {
          currentBalance: {
            increment: updatedDonation.amount,
          },
          lastTransactionId: updatedDonation.transactionId,
          updatedAt: new Date(),
        },
      });

      await tx.transaction.create({
        data: {
          donationId: updatedDonation.id,
          amount: updatedDonation.amount,
          balanceAfter: wallet.currentBalance,
          type: 'donation',
          ip: updatedDonation.ip,
          transactionId: updatedDonation.transactionId,
          userId: updatedDonation.userId,
        },
      });

      return updatedDonation;
    });
  }

  async create(data: CreateDonationParams) {
    return await this.prismaService.donation.create({
      data: {
        userId: data.userId,
        name: data.name,
        amount: data.amount,
        transactionId: data.transactionId,
        paymentMethod: data.paymentMethod,
        ip: data.ip,
        messageRaw: data.messageRaw,
        voiceId: data.voiceId,
        pix: data.pix,
        status: data.status,
        expiredAt: data.expiredAt,
        approvedAt: data.approvedAt,
        messageType: data.messageType,
        message: data.message,
        voiceUrl: data.voiceUrl,
      },
    });
  }

  async findById(id: string) {
    return await this.prismaService.donation.findUnique({ where: { id } });
  }

  async findByTransactionId(transactionId: string) {
    return await this.prismaService.donation.findUnique({
      where: { transactionId: transactionId },
    });
  }

  async update(id: string, data: UpdateDonationParams) {
    return await this.prismaService.donation.update({
      where: { id },
      data: {
        name: data.name,
        amount: data.amount,
        ip: data.ip,
        messageRaw: data.messageRaw,
        voiceId: data.voiceId,
        pix: data.pix,
        status: data.status,
        expiredAt: data.expiredAt,
        approvedAt: data.approvedAt,
        paymentMethod: data.paymentMethod,
        transactionId: data.transactionId,
        messageType: data.messageType,
        message: data.message,
        voiceUrl: data.voiceUrl,
      },
    });
  }

  async findManyByIds(ids: string[]) {
    return await this.prismaService.donation.findMany({
      where: { id: { in: ids } },
    });
  }
}

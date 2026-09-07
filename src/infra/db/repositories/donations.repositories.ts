import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  DonationAlreadyProcessedError,
  DonationNotFoundError,
} from '../../../common/errors/donations.errors';
import {
  CreateDonationParams,
  UpdateDonationParams,
} from './dto/donations.dto';
import { ProcessDonationParams } from './dto/transactions.dto';
import { WalletsRepository } from './wallets.repositories';

@Injectable()
export class DonationsRepository {
  constructor(
    private prismaService: PrismaService,
    private walletsRepository: WalletsRepository,
  ) {}

  async processDonation({
    donationId,
    message,
    voiceUri,
  }: ProcessDonationParams) {
    return await this.prismaService.$transaction(async (tx) => {
      const donation = await tx.donation.findUnique({
        where: { id: donationId },
      });

      if (!donation) {
        throw new DonationNotFoundError();
      }

      if (donation.status !== 'pending' && donation.status !== 'expired') {
        throw new DonationAlreadyProcessedError();
      }

      const updateResult = await tx.donation.updateMany({
        where: { id: donationId, status: { in: ['pending', 'expired'] } },
        data: {
          status: 'paid',
          message: message,
          approvedAt: new Date(),
          voiceUrl: voiceUri,
        },
      });

      if (updateResult.count === 0) {
        throw new DonationAlreadyProcessedError();
      }

      const updatedDonation = await tx.donation.findUniqueOrThrow({
        where: { id: donationId },
      });

      await this.walletsRepository.creditDonation(tx, updatedDonation);

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

  async findOverdue(
    expiredBefore: Date,
    limit: number,
  ): Promise<{ id: string; transactionId: string }[]> {
    return await this.prismaService.donation.findMany({
      where: { status: 'pending', expiredAt: { lt: expiredBefore } },
      select: { id: true, transactionId: true },
      orderBy: { expiredAt: 'asc' },
      take: limit,
    });
  }

  async expireById(id: string): Promise<void> {
    await this.prismaService.donation.updateMany({
      where: { id, status: 'pending' },
      data: { status: 'expired' },
    });
  }

  async expireOverdue(expiredBefore: Date): Promise<number> {
    const result = await this.prismaService.donation.updateMany({
      where: { status: 'pending', expiredAt: { lt: expiredBefore } },
      data: { status: 'expired' },
    });
    return result.count;
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

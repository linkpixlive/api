import { Injectable } from '@nestjs/common';
import { Donation, DonationStatus, Prisma } from '@prisma/client';
import {
  getRetentionStart,
  getTodayStart,
} from 'src/common/utils/history-retention.util';
import { PrismaService } from '../prisma.service';
import {
  CreateDonationParams,
  GetDonationHistoryParams,
  UpdateDonationParams,
} from './dto/donations.dto';
import {
  DonationAlreadyProcessedError,
  DonationNotFoundError,
} from '../../../common/errors/donations.errors';
import { ProcessDonationParams } from './dto/transactions.dto';
import { WalletsRepository } from './wallets.repositories';

@Injectable()
export class DonationsRepository {
  constructor(
    private prismaService: PrismaService,
    private walletsRepository: WalletsRepository,
  ) {}

  async processDonation({ donationId, voiceUri }: ProcessDonationParams) {
    return await this.prismaService.$transaction(async (tx) => {
      const updateResult = await tx.donation.updateMany({
        where: { id: donationId, status: { in: ['pending', 'expired'] } },
        data: {
          status: 'paid',
          approvedAt: new Date(),
          voiceUrl: voiceUri,
        },
      });

      if (updateResult.count === 0) {
        const donation = await tx.donation.findUnique({
          where: { id: donationId },
        });
        if (!donation) {
          throw new DonationNotFoundError();
        }
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
    return await this.prismaService.donation.create({ data });
  }

  async findById(id: string) {
    return await this.prismaService.donation.findUnique({ where: { id } });
  }

  async findByIdWithUser(id: string) {
    return await this.prismaService.donation.findUnique({
      where: { id },
      include: {
        user: { select: { username: true, name: true } },
        voice: { select: { name: true } },
      },
    });
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
      where: { transactionId },
    });
  }

  async update(id: string, data: UpdateDonationParams) {
    return await this.prismaService.donation.update({
      where: { id },
      data,
    });
  }

  async findManyByIds(ids: string[]) {
    return await this.prismaService.donation.findMany({
      where: { id: { in: ids } },
    });
  }

  async getDonationHistory(
    params: GetDonationHistoryParams,
  ): Promise<{ donations: Donation[]; total: number }> {
    return params.search && params.searchBy === 'message'
      ? this.getHistoryByMessagePattern(params)
      : this.getHistoryByFilters(params);
  }

  async findDonationAudioMeta(
    donationId: string,
    userId: string,
  ): Promise<Pick<
    Donation,
    'voiceUrl' | 'name' | 'approvedAt' | 'createdAt'
  > | null> {
    return this.prismaService.donation.findFirst({
      where: { id: donationId, userId },
      select: { voiceUrl: true, name: true, approvedAt: true, createdAt: true },
    });
  }

  private async getHistoryByMessagePattern(
    params: GetDonationHistoryParams,
  ): Promise<{ donations: Donation[]; total: number }> {
    const escaped = params.search!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = `\\m${escaped}\\M`;
    const { gte } = this.resolveHistoryWindow(params.days);

    const statusFilter = params.status
      ? Prisma.sql`status = ${params.status}`
      : Prisma.sql`status IN ('paid', 'displayed')`;
    const baseWhere = Prisma.sql`user_id = ${params.userId}
      AND ${statusFilter}
      AND created_at >= ${gte}
      AND message ~* ${pattern}`;

    const [countResult, donations] = await Promise.all([
      this.prismaService.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) AS count
        FROM donations
        WHERE ${baseWhere}
      `,
      this.prismaService.$queryRaw<Donation[]>`
        SELECT
          id,
          name,
          amount,
          message,
          message_type AS "messageType",
          status,
          voice_url AS "voiceUrl",
          approved_at AS "approvedAt"
        FROM donations
        WHERE ${baseWhere}
        ORDER BY created_at DESC
        LIMIT ${params.limit} OFFSET ${(params.page - 1) * params.limit}
      `,
    ]);

    return { donations, total: Number(countResult[0]?.count ?? 0) };
  }

  private resolveHistoryWindow(days: GetDonationHistoryParams['days']): {
    gte: Date;
    lte?: Date;
  } {
    const now = new Date();
    if (days === 'today') return { gte: getTodayStart(now) };
    if (days === undefined) return { gte: getRetentionStart(now) };
    const lte = new Date(now);
    lte.setHours(23, 59, 59, 999);
    const gte = new Date(now);
    gte.setDate(gte.getDate() - days + 1);
    gte.setHours(0, 0, 0, 0);
    return { gte, lte };
  }

  private async getHistoryByFilters(
    params: GetDonationHistoryParams,
  ): Promise<{ donations: Donation[]; total: number }> {
    const where: Prisma.DonationWhereInput = {
      userId: params.userId,
      status: params.status
        ? { equals: params.status }
        : { in: ['paid', 'displayed'] as DonationStatus[] },
    };

    const { gte, lte } = this.resolveHistoryWindow(params.days);
    where.createdAt = lte ? { gte, lte } : { gte };

    if (params.search) {
      where.name = { contains: params.search, mode: 'insensitive' };
    }

    const skip = (params.page - 1) * params.limit;
    const [donations, total] = await Promise.all([
      this.prismaService.donation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: params.limit,
      }),
      this.prismaService.donation.count({ where }),
    ]);

    return { donations, total };
  }
}

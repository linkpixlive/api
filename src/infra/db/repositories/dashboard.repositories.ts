import { Injectable } from '@nestjs/common';
import { Donation, DonationStatus, Prisma } from '@prisma/client';
import {
  getRetentionStart,
  getTodayStart,
} from 'src/common/utils/history-retention.util';
import { PrismaService } from '../prisma.service';
import { GetDonationHistoryParams } from './dto/dashboard.dto';

export interface DashboardSeriesPoint {
  date: string;
  amount: number;
  count: number;
}

export interface DashboardLargest {
  amount: number;
  donorName: string;
  date: string;
}

export interface DashboardStats {
  rangeDays: number;
  start: Date;
  end: Date;
  totalAmount: number;
  totalCount: number;
  previousAmount: number;
  previousCount: number;
  series: DashboardSeriesPoint[];
  largest: DashboardLargest | null;
  peakDay: number | null;
  peakHour: number | null;
  modeAmount: number | null;
}

@Injectable()
export class DashboardRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async getDashboardStats(
    userId: string,
    range: '7' | '15' | '30' = '7',
  ): Promise<DashboardStats> {
    const rangeDays = Number(range) as 7 | 15 | 30;

    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - rangeDays + 1);
    start.setHours(0, 0, 0, 0);
    const previousEnd = new Date(start.getTime() - 1);
    const previousStart = new Date(start);
    previousStart.setDate(previousStart.getDate() - rangeDays);

    const baseWhere = Prisma.sql`user_id = ${userId}
      AND status IN ('paid', 'displayed')
      AND created_at >= ${start}
      AND created_at <= ${end}`;
    const previousWhere = Prisma.sql`user_id = ${userId}
      AND status IN ('paid', 'displayed')
      AND created_at >= ${previousStart}
      AND created_at <= ${previousEnd}`;

    const [
      statsResult,
      previousResult,
      peakResult,
      modeResult,
      seriesResult,
      largestResult,
    ] = await Promise.all([
      this.prismaService.$queryRaw<
        { total_amount: Prisma.Decimal; total_count: bigint }[]
      >`
          SELECT
            COALESCE(SUM(amount), 0) AS total_amount,
            COUNT(*) AS total_count
          FROM donations
          WHERE ${baseWhere}
        `,

      this.prismaService.$queryRaw<
        { total_amount: Prisma.Decimal; total_count: bigint }[]
      >`
          SELECT
            COALESCE(SUM(amount), 0) AS total_amount,
            COUNT(*) AS total_count
          FROM donations
          WHERE ${previousWhere}
        `,

      this.prismaService.$queryRaw<
        { peak_day: number; peak_hour: number; donation_count: bigint }[]
      >`
          SELECT
            EXTRACT(DOW FROM created_at)::int AS peak_day,
            EXTRACT(HOUR FROM created_at)::int AS peak_hour,
            COUNT(*) AS donation_count
          FROM donations
          WHERE ${baseWhere}
          GROUP BY peak_day, peak_hour
          ORDER BY donation_count DESC
          LIMIT 1
        `,

      this.prismaService.$queryRaw<
        { mode_amount: Prisma.Decimal; occurrence_count: bigint }[]
      >`
          SELECT
            amount AS mode_amount,
            COUNT(*) AS occurrence_count
          FROM donations
          WHERE ${baseWhere}
          GROUP BY amount
          ORDER BY occurrence_count DESC
          LIMIT 1
        `,

      this.prismaService.$queryRaw<
        {
          day: Date | string;
          total_amount: Prisma.Decimal;
          total_count: bigint;
        }[]
      >`
          SELECT
            date_trunc('day', created_at)::date AS day,
            COALESCE(SUM(amount), 0) AS total_amount,
            COUNT(*) AS total_count
          FROM donations
          WHERE ${baseWhere}
          GROUP BY day
          ORDER BY day ASC
        `,

      this.prismaService.$queryRaw<
        { amount: Prisma.Decimal; name: string; ref_date: Date }[]
      >`
          SELECT
            amount,
            name,
            COALESCE(approved_at, created_at) AS ref_date
          FROM donations
          WHERE ${baseWhere}
          ORDER BY amount DESC, ref_date DESC
          LIMIT 1
        `,
    ]);

    const stats = statsResult[0];
    const previous = previousResult[0];
    const peak = peakResult[0] ?? null;
    const mode = modeResult[0] ?? null;
    const largestRow = largestResult[0] ?? null;

    const byDay = new Map<string, { amount: number; count: number }>();
    for (const row of seriesResult) {
      const key =
        row.day instanceof Date
          ? row.day.toISOString().slice(0, 10)
          : String(row.day).slice(0, 10);
      byDay.set(key, {
        amount: Number(row.total_amount),
        count: Number(row.total_count),
      });
    }

    const series: DashboardSeriesPoint[] = [];
    for (let i = 0; i < rangeDays; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const found = byDay.get(key);
      series.push({
        date: key,
        amount: found?.amount ?? 0,
        count: found?.count ?? 0,
      });
    }

    return {
      rangeDays,
      start,
      end,
      totalAmount: Number(stats.total_amount),
      totalCount: Number(stats.total_count),
      previousAmount: Number(previous.total_amount),
      previousCount: Number(previous.total_count),
      series,
      largest: largestRow
        ? {
            amount: Number(largestRow.amount),
            donorName: largestRow.name,
            date: new Date(largestRow.ref_date).toISOString(),
          }
        : null,
      peakDay: peak ? peak.peak_day : null,
      peakHour: peak ? peak.peak_hour : null,
      modeAmount: mode ? Number(mode.mode_amount) : null,
    };
  }

  async getDonationHistory(
    params: GetDonationHistoryParams,
  ): Promise<{ donations: Donation[]; total: number }> {
    return params.search && params.searchBy === 'message'
      ? this.getHistoryByMessagePattern(params)
      : this.getHistoryByFilters(params);
  }

  private async getHistoryByMessagePattern(
    params: GetDonationHistoryParams,
  ): Promise<{ donations: Donation[]; total: number }> {
    const escaped = params.search!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = `\\m${escaped}\\M`;
    const retentionStart = this.resolveRetentionStart(params.days);

    const statusFilter = params.status
      ? Prisma.sql`status = ${params.status}`
      : Prisma.sql`status IN ('paid', 'displayed')`;

    const [countResult, donations] = await Promise.all([
      this.prismaService.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) AS count
        FROM donations
        WHERE user_id = ${params.userId}
          AND ${statusFilter}
          AND created_at >= ${retentionStart}
          AND message ~* ${pattern}
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
        WHERE user_id = ${params.userId}
          AND ${statusFilter}
          AND created_at >= ${retentionStart}
          AND message ~* ${pattern}
        ORDER BY created_at DESC
        LIMIT ${params.limit} OFFSET ${(params.page - 1) * params.limit}
      `,
    ]);

    return { donations, total: Number(countResult[0]?.count ?? 0) };
  }

  private resolveRetentionStart(days: GetDonationHistoryParams['days']): Date {
    const now = new Date();
    if (days === 'today') return getTodayStart(now);
    if (days === undefined) return getRetentionStart(now);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const start = new Date(now);
    start.setDate(start.getDate() - days + 1);
    start.setHours(0, 0, 0, 0);
    return start;
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

    if (params.days === 'today') {
      where.createdAt = { gte: getTodayStart() };
    } else if (params.days !== undefined) {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const start = new Date();
      start.setDate(start.getDate() - params.days + 1);
      start.setHours(0, 0, 0, 0);
      where.createdAt = { gte: start, lte: end };
    } else {
      where.createdAt = { gte: getRetentionStart() };
    }

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
}

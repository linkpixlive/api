import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

// interface DashboardStatsRaw {
//   total_amount: Prisma.Decimal;
//   total_count: bigint;
//   peak_day: number | null;
//   peak_hour: number | null;
//   mode_amount: Prisma.Decimal | null;
// }

export interface DashboardStats {
  totalAmount: number;
  totalCount: number;
  peakDay: number | null;
  peakHour: number | null;
  modeAmount: number | null;
}

@Injectable()
export class DashboardRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async getDashboardStats(userId: string): Promise<DashboardStats> {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [statsResult, peakResult, modeResult] = await Promise.all([
      this.prismaService.$queryRaw<
        { total_amount: Prisma.Decimal; total_count: bigint }[]
      >`
        SELECT
          COALESCE(SUM(amount), 0) AS total_amount,
          COUNT(*) AS total_count
        FROM donations
        WHERE user_id = ${userId}
          AND status IN ('paid', 'displayed')
          AND created_at >= ${since}
      `,

      this.prismaService.$queryRaw<
        { peak_day: number; peak_hour: number; donation_count: bigint }[]
      >`
        SELECT
          EXTRACT(DOW FROM created_at)::int AS peak_day,
          EXTRACT(HOUR FROM created_at)::int AS peak_hour,
          COUNT(*) AS donation_count
        FROM donations
        WHERE user_id = ${userId}
          AND status IN ('paid', 'displayed')
          AND created_at >= ${since}
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
        WHERE user_id = ${userId}
          AND status IN ('paid', 'displayed')
          AND created_at >= ${since}
        GROUP BY amount
        ORDER BY occurrence_count DESC
        LIMIT 1
      `,
    ]);

    const stats = statsResult[0];
    const peak = peakResult[0] ?? null;
    const mode = modeResult[0] ?? null;

    return {
      totalAmount: Number(stats.total_amount),
      totalCount: Number(stats.total_count),
      peakDay: peak ? peak.peak_day : null,
      peakHour: peak ? peak.peak_hour : null,
      modeAmount: mode ? Number(mode.mode_amount) : null,
    };
  }

  async getDonationHistory(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [donations, total] = await Promise.all([
      this.prismaService.donation.findMany({
        where: {
          user_id: userId,
          status: { in: ['paid', 'displayed'] },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prismaService.donation.count({
        where: {
          user_id: userId,
          status: { in: ['paid', 'displayed'] },
        },
      }),
    ]);

    return { donations, total };
  }
}

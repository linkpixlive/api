import { Injectable } from '@nestjs/common';
import { Donation, DonationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { GetDonationHistoryParams } from './dto/dashboard.dto';

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

    // Política do dataset: apenas doações confirmadas (paid/displayed) nos
    // últimos 30 dias — compartilhada pelas três queries.
    const baseWhere = Prisma.sql`user_id = ${userId}
      AND status IN ('paid', 'displayed')
      AND created_at >= ${since}`;

    const [statsResult, peakResult, modeResult] = await Promise.all([
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

  async getDonationHistory(
    params: GetDonationHistoryParams,
  ): Promise<{ donations: Donation[]; total: number }> {
    // Política do dataset: apenas doações confirmadas (paid/displayed) compõem
    // o histórico — pending/failed/expired nunca aparecem.
    return params.search && params.searchBy === 'message'
      ? this.getHistoryByMessagePattern(params)
      : this.getHistoryByFilters(params);
  }

  // Busca por mensagem é whole-word por decisão de produto: a word-boundary
  // nativa do Postgres (\m/\M) mantém busca e paginação no banco, sem
  // carregar a tabela em memória.
  private async getHistoryByMessagePattern(
    params: GetDonationHistoryParams,
  ): Promise<{ donations: Donation[]; total: number }> {
    const escaped = params.search!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = `\\m${escaped}\\M`;

    const statusFilter = params.status
      ? Prisma.sql`status = ${params.status}`
      : Prisma.sql`status IN ('paid', 'displayed')`;

    const [countResult, donations] = await Promise.all([
      this.prismaService.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) AS count
        FROM donations
        WHERE user_id = ${params.userId}
          AND ${statusFilter}
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
          message_raw AS "messageRaw",
          voice_url AS "voiceUrl",
          approved_at AS "approvedAt"
        FROM donations
        WHERE user_id = ${params.userId}
          AND ${statusFilter}
          AND message ~* ${pattern}
        ORDER BY created_at DESC
        LIMIT ${params.limit} OFFSET ${(params.page - 1) * params.limit}
      `,
    ]);

    return { donations, total: Number(countResult[0]?.count ?? 0) };
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

    if (params.days) {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const start = new Date();
      start.setDate(start.getDate() - params.days + 1);
      start.setHours(0, 0, 0, 0);
      where.createdAt = { gte: start, lte: end };
    }

    // Nesta estratégia search só chega com searchBy='name' (busca por
    // mensagem segue getHistoryByMessagePattern).
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

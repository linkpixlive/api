import { Injectable } from '@nestjs/common';
import { DashboardRepository } from 'src/infra/db/repositories/dashboard.repositories';
import { DashboardStatsEntity } from './entities/dashboard-stats.entity';

@Injectable()
export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  async getStats(
    userId: string,
    range: '7' | '15' | '30' = '7',
  ): Promise<DashboardStatsEntity> {
    const stats = await this.dashboardRepository.getDashboardStats(
      userId,
      range,
    );

    const average =
      stats.totalCount > 0 ? stats.totalAmount / stats.totalCount : 0;

    const deltaAmountPct =
      stats.previousAmount > 0
        ? Math.round(
            ((stats.totalAmount - stats.previousAmount) /
              stats.previousAmount) *
              1000,
          ) / 10
        : null;
    const deltaCountPct =
      stats.previousCount > 0
        ? Math.round(
            ((stats.totalCount - stats.previousCount) / stats.previousCount) *
              1000,
          ) / 10
        : null;

    return new DashboardStatsEntity({
      range,
      start: stats.start.toISOString(),
      end: stats.end.toISOString(),
      totalAmount: stats.totalAmount,
      totalCount: stats.totalCount,
      average: Math.round(average * 100) / 100,
      largest: stats.largest
        ? {
            ...stats.largest,
            donorName: stats.largest.donorName || 'Anônimo',
          }
        : null,
      previous: {
        amount: stats.previousAmount,
        count: stats.previousCount,
      },
      deltaAmountPct,
      deltaCountPct,
      series: stats.series,
      peakDay: stats.peakDay,
      peakHour: stats.peakHour,
      modeAmount: stats.modeAmount,
    });
  }
}

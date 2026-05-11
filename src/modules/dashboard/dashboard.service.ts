import { Injectable } from '@nestjs/common';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { DashboardRepository } from 'src/infra/db/repositories/dashboard.repositories';
import { DashboardStatsEntity } from './entities/dashboard-stats.entity';
import { DonationHistoryEntity } from './entities/donation-history.entity';

@Injectable()
export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  async getStats(userId: string): Promise<DashboardStatsEntity> {
    const stats = await this.dashboardRepository.getDashboardStats(userId);
    return new DashboardStatsEntity(stats);
  }

  async getHistory(
    userId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResponseDto<DonationHistoryEntity>> {
    const { donations, total } =
      await this.dashboardRepository.getDonationHistory(userId, page, limit);

    const history = donations.map((d) => new DonationHistoryEntity(d));

    return new PaginatedResponseDto(history, {
      total,
      page,
      limit,
    });
  }
}

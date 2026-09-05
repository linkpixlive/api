import { Injectable } from '@nestjs/common';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { DashboardRepository } from 'src/infra/db/repositories/dashboard.repositories';
import { GetDonationHistoryParams } from 'src/infra/db/repositories/dto/dashboard.dto';
import { GetHistoryQueryDto } from './dto/get-history-query.dto';
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
    query: GetHistoryQueryDto,
  ): Promise<PaginatedResponseDto<DonationHistoryEntity>> {
    const params: GetDonationHistoryParams = {
      userId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      status: query.status,
      days: query.days ? (Number(query.days) as 7 | 15 | 30) : undefined,
      search: query.search,
      searchBy: query.searchBy,
    };

    const { donations, total } =
      await this.dashboardRepository.getDonationHistory(params);

    const history = donations.map((d) => DonationHistoryEntity.fromDonation(d));

    return new PaginatedResponseDto(history, {
      total,
      page: params.page,
      limit: params.limit,
    });
  }
}

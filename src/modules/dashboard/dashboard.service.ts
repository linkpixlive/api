import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { DashboardRepository } from 'src/infra/db/repositories/dashboard.repositories';
import { DonationsRepository } from 'src/infra/db/repositories/donations.repositories';
import { OverlayGateway } from 'src/infra/websocket/overlay.gateway';
import { OverlayDonationEntity } from '../donations/entities/overlay-donation.entity';
import { DashboardStatsEntity } from './entities/dashboard-stats.entity';
import { DonationHistoryEntity } from './entities/donation-history.entity';

@Injectable()
export class DashboardService {
  constructor(
    private readonly dashboardRepository: DashboardRepository,
    private readonly donationsRepository: DonationsRepository,
    private readonly overlayGateway: OverlayGateway,
    private readonly configService: ConfigService,
  ) {}

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

    const history = donations.map((d) => DonationHistoryEntity.toResponse(d));

    return new PaginatedResponseDto(history, {
      total,
      page,
      limit,
    });
  }

  skip(overlayKey: string) {
    return this.overlayGateway.emitSkipAlert(overlayKey);
  }

  pause(overlayKey: string) {
    return this.overlayGateway.emitPauseAlerts(overlayKey);
  }

  resume(overlayKey: string) {
    return this.overlayGateway.emitResumeAlerts(overlayKey);
  }

  clear(overlayKey: string) {
    return this.overlayGateway.emitClearAlerts(overlayKey);
  }

  async replay(userId: string, overlayKey: string, donationId: string) {
    const donation = await this.donationsRepository.findById(donationId);

    if (!donation || donation.user_id !== userId) {
      throw new NotFoundException('Donation not found');
    }

    const audioUrl = donation.voice_url
      ? `${this.configService.get('BUCKET_URL')}/${donation.voice_url}`
      : null;

    return this.overlayGateway.emitNewDonation(
      overlayKey,
      OverlayDonationEntity.toResponse(donation, audioUrl),
    );
  }
}

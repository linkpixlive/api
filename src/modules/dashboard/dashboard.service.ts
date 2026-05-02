import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { DashboardRepository } from 'src/infra/db/repositories/dashboard.repositories';
import { DonationsRepository } from 'src/infra/db/repositories/donations.repositories';
import { OverlayGateway } from 'src/infra/websocket/overlay.gateway';
import { OverlayDonationEntity } from '../donations/entities/overlay-donation.entity';
import { WidgetRepository } from 'src/infra/db/repositories/widget.repositories';
import { DashboardStatsEntity } from './entities/dashboard-stats.entity';
import { DonationHistoryEntity } from './entities/donation-history.entity';

@Injectable()
export class DashboardService {
  constructor(
    private readonly dashboardRepository: DashboardRepository,
    private readonly donationsRepository: DonationsRepository,
    private readonly overlayGateway: OverlayGateway,
    private readonly configService: ConfigService,
    private readonly widgetRepository: WidgetRepository,
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

    const history = donations.map((d) => new DonationHistoryEntity(d));

    return new PaginatedResponseDto(history, {
      total,
      page,
      limit,
    });
  }

  async skip(userId: string) {
    const overlay = await this.getOverlayOrThrow(userId);
    return this.overlayGateway.emitSkipAlert(overlay.token);
  }

  async pause(userId: string) {
    const overlay = await this.getOverlayOrThrow(userId);
    return this.overlayGateway.emitPauseAlerts(overlay.token);
  }

  async resume(userId: string) {
    const overlay = await this.getOverlayOrThrow(userId);
    return this.overlayGateway.emitResumeAlerts(overlay.token);
  }

  async clear(userId: string) {
    const overlay = await this.getOverlayOrThrow(userId);
    return this.overlayGateway.emitClearAlerts(overlay.token);
  }

  async replay(userId: string, donationId: string) {
    const donation = await this.donationsRepository.findById(donationId);

    if (!donation || donation.userId !== userId) {
      throw new NotFoundException('Donation not found');
    }

    const overlay = await this.getOverlayOrThrow(userId);

    const audioUrl = donation.voiceUrl
      ? `${this.configService.get('BUCKET_URL')}/${donation.voiceUrl}`
      : null;

    return this.overlayGateway.emitNewDonation(
      overlay.token,
      OverlayDonationEntity.toResponse(donation, audioUrl),
    );
  }

  private async getOverlayOrThrow(userId: string) {
    const overlay = await this.widgetRepository.findByUserAndType(
      userId,
      'overlay',
    );

    if (!overlay || !overlay.active) {
      throw new NotFoundException('Active overlay not found');
    }

    return overlay;
  }
}

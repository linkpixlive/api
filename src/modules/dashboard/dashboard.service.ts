import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { DashboardRepository } from 'src/infra/db/repositories/dashboard.repositories';
import { DonationsRepository } from 'src/infra/db/repositories/donations.repositories';
import { OverlayGateway } from 'src/infra/websocket/overlay.gateway';

@Injectable()
export class DashboardService {
  constructor(
    private readonly dashboardRepository: DashboardRepository,
    private readonly donationsRepository: DonationsRepository,
    private readonly overlayGateway: OverlayGateway,
  ) {}

  async getStats(userId: string) {
    return this.dashboardRepository.getDashboardStats(userId);
  }

  async getHistory(userId: string, page: number, limit: number) {
    const { donations, total } =
      await this.dashboardRepository.getDonationHistory(userId, page, limit);

    return new PaginatedResponseDto(donations, {
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

    return this.overlayGateway.emitReplayDonation(overlayKey, {
      id: donation.id,
      name: donation.name,
      amount: Number(donation.amount),
      message: donation.message,
      voice_url: donation.voice_url,
      message_type: donation.message_type,
    });
  }
}

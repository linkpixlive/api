import { Injectable, NotFoundException } from '@nestjs/common';
import type { Readable } from 'node:stream';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { DashboardRepository } from 'src/infra/db/repositories/dashboard.repositories';
import { GetDonationHistoryParams } from 'src/infra/db/repositories/dto/dashboard.dto';
import { StorageContract } from 'src/infra/storage/contract/storage.contract';
import { GetHistoryQueryDto } from './dto/get-history-query.dto';
import { DashboardStatsEntity } from './entities/dashboard-stats.entity';
import { DonationHistoryEntity } from './entities/donation-history.entity';

export interface DonationAudioDownload {
  stream: Readable;
  contentType: string;
  contentLength?: number;
  filename: string;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly dashboardRepository: DashboardRepository,
    private readonly storage: StorageContract,
  ) {}

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

  async getDonationAudio(
    userId: string,
    donationId: string,
  ): Promise<DonationAudioDownload> {
    const donation = await this.dashboardRepository.findDonationAudioMeta(
      donationId,
      userId,
    );

    if (!donation?.voiceUrl) {
      throw new NotFoundException('Áudio não disponível para esta doação.');
    }

    let stored;
    try {
      stored = await this.storage.getObject(donation.voiceUrl);
    } catch {
      throw new NotFoundException('Áudio não disponível para esta doação.');
    }

    const ext = donation.voiceUrl.toLowerCase().endsWith('.mp3')
      ? 'mp3'
      : 'wav';
    const slug =
      donation.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'doacao';
    const stamp = donation.approvedAt
      ? new Date(donation.approvedAt).getTime()
      : donationId;

    return {
      stream: stored.body,
      contentType:
        stored.contentType ?? (ext === 'mp3' ? 'audio/mpeg' : 'audio/wav'),
      contentLength: stored.contentLength,
      filename: `doacao-${slug}-${stamp}.${ext}`,
    };
  }
}

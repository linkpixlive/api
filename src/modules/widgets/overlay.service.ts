import {
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { Widget, WidgetType } from '@prisma/client';
import { getAudioUrl } from 'src/common/utils/audioUrl.util';
import { DonationsRepository } from 'src/infra/db/repositories/donations.repositories';
import { WidgetRepository } from 'src/infra/db/repositories/widget.repositories';
import { RedisService } from 'src/infra/redis/redis.service';
import { DashboardGateway } from 'src/infra/websocket/dashboard.gateway';
import { OverlayGateway } from 'src/infra/websocket/overlay.gateway';
import { OverlayDonationEntity } from 'src/modules/donations/entities/overlay-donation.entity';
import { OverlayWidgetSettingsDto } from './dto/overlay-settings.dto';

@Injectable()
export class OverlayService {
  constructor(
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => OverlayGateway))
    private readonly overlayGateway: OverlayGateway,
    @Inject(forwardRef(() => DashboardGateway))
    private readonly dashboardGateway: DashboardGateway,
    private readonly widgetRepository: WidgetRepository,
    private readonly donationsRepository: DonationsRepository,
  ) {}

  // ─── Overlay Connection ──────────────────────────────────────────────────────

  async registerConnection(token: string) {
    const widget = await this.widgetRepository.findByToken(token);
    if (!widget || !widget.active) return false;

    await this.updateOnlineStatus(token);
    this.dashboardGateway.emitOverlayStatus(widget.userId, true);
    await this.syncQueue(widget.userId, token);
    return true;
  }

  async unregisterConnection(token: string) {
    const widget = await this.widgetRepository.findByToken(token);
    await this.redisService.remove(`overlay:${token}`);
    if (widget) this.dashboardGateway.emitOverlayStatus(widget.userId, false);
  }

  async updateOnlineStatus(token: string) {
    await this.redisService.setWithExpire(`overlay:${token}`, 80, 'true');
  }

  // ─── Queue Orchestration ─────────────────────────────────────────────────────

  async handleNewDonation(overlay: Widget, donationId: string) {
    const token = overlay.token;
    const settings = overlay.settings as unknown as OverlayWidgetSettingsDto;

    const isOnline = await this.redisService.get<string>(`overlay:${token}`);
    if (!isOnline) return;

    const queueKey = `overlay:queue:${token}`;
    await this.redisService.addToListEnd(queueKey, donationId);

    await this.syncQueue(overlay.userId, token);

    const queueLength = await this.redisService.getListLength(queueKey);
    if (!settings.isPaused && queueLength === 1) {
      await this.dispatchNext(token);
    }
  }

  async dispatchNext(token: string) {
    const queueKey = `overlay:queue:${token}`;
    const donationId = await this.redisService.removeFromListStart(queueKey);
    if (!donationId) return;

    const donation = await this.donationsRepository.findById(donationId);

    if (!donation) {
      const widget = await this.widgetRepository.findByToken(token);
      if (widget) await this.syncQueue(widget.userId, token);
      return;
    }

    const audioUrl = getAudioUrl(donation.voiceUrl);
    this.overlayGateway.emitNewDonation(
      token,
      OverlayDonationEntity.toResponse(donation, audioUrl),
    );

    const widget = await this.widgetRepository.findByToken(token);
    if (widget) await this.syncQueue(widget.userId, token);
  }

  async alertFinished(token: string, donationId: string) {
    await this.donationsRepository.update(donationId, { status: 'displayed' });
    await this.dispatchNext(token);
  }

  // ─── Dashboard Actions (called from OverlayController via HTTP) ───────────────

  async togglePause(userId: string) {
    const widget = await this.getActiveOverlay(userId);

    const settings = widget.settings as unknown as OverlayWidgetSettingsDto;
    settings.isPaused = !settings.isPaused;

    const updated = await this.widgetRepository.update(userId, {
      type: WidgetType.overlay,
      settings: settings,
    });

    this.overlayGateway.emitSettingsUpdated(updated.token);

    if (!settings.isPaused) await this.dispatchNext(updated.token);

    return updated.settings;
  }

  async skipCurrent(userId: string) {
    const widget = await this.getActiveOverlay(userId);
    this.overlayGateway.emitSkipAlert(widget.token);
    await this.dispatchNext(widget.token);
  }

  async clearQueue(userId: string) {
    const widget = await this.getActiveOverlay(userId);
    await this.redisService.remove(`overlay:queue:${widget.token}`);
    this.overlayGateway.emitClearAlerts(widget.token);
    this.dashboardGateway.emitQueueSync(userId, []);
  }

  async replayDonation(userId: string, donationId: string) {
    const [widget, donation] = await Promise.all([
      this.getActiveOverlay(userId),
      this.donationsRepository.findById(donationId),
    ]);

    if (!donation || donation.userId !== userId) {
      throw new NotFoundException('Donation not found');
    }

    const queueKey = `overlay:queue:${widget.token}`;
    await this.redisService.addToListEnd(queueKey, donationId);

    await this.syncQueue(userId, widget.token);

    const queueLength = await this.redisService.getListLength(queueKey);
    const settings = widget.settings as unknown as OverlayWidgetSettingsDto;

    if (!settings.isPaused && queueLength === 1) {
      await this.dispatchNext(widget.token);
    }
  }

  async testOverlay(userId: string) {
    const widget = await this.getActiveOverlay(userId);
    this.overlayGateway.emitTestNotification(widget.token);
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private async getActiveOverlay(userId: string) {
    const widget = await this.widgetRepository.findByUserAndType(
      userId,
      WidgetType.overlay,
    );
    if (!widget || !widget.active)
      throw new NotFoundException('Active overlay not found');
    return widget;
  }

  private async syncQueue(userId: string, token: string) {
    const queueKey = `overlay:queue:${token}`;
    const donationIds = await this.redisService.getListRange(queueKey, 0, -1);

    if (donationIds.length === 0) {
      this.dashboardGateway.emitQueueSync(userId, []);
      return;
    }

    const donations = await this.donationsRepository.findManyByIds(donationIds);
    const donationMap = new Map(donations.map((d) => [d.id, d]));

    const queue = donationIds
      .map((id) => {
        const donation = donationMap.get(id);
        if (!donation) return null;
        return OverlayDonationEntity.toResponse(
          donation,
          getAudioUrl(donation.voiceUrl),
        );
      })
      .filter((item): item is OverlayDonationEntity => item !== null);

    this.dashboardGateway.emitQueueSync(userId, queue);
  }
}

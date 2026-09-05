import {
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { Donation, Widget, WidgetType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { getAudioUrl } from 'src/common/utils/audioUrl.util';
import { DonationsRepository } from 'src/infra/db/repositories/donations.repositories';
import { WidgetRepository } from 'src/infra/db/repositories/widget.repositories';
import { REDIS_TTL, RedisKeys } from 'src/infra/redis/redis-keys';
import { RedisService } from 'src/infra/redis/redis.service';
import { DashboardGateway } from 'src/infra/websocket/dashboard.gateway';
import { OverlayGateway } from 'src/infra/websocket/overlay.gateway';
import { OverlayDonationEntity } from 'src/modules/donations/entities/overlay-donation.entity';
import { DonationHistoryEntity } from '../dashboard/entities/donation-history.entity';
import { OverlayWidgetSettingsDto } from './dto/overlay-settings.dto';

const TEST_ID_PREFIX = 'test-';

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

    const settings = widget.settings as unknown as OverlayWidgetSettingsDto;

    await this.updateOnlineStatus(token);
    this.dashboardGateway.emitOverlayStatus(
      widget.userId,
      true,
      settings.isPaused,
    );
    await this.resendCurrentAlert(token);
    await this.syncDashboardQueue(widget.userId, token);
    return true;
  }

  async emitDashboardState(userId: string) {
    const widget = await this.widgetRepository.findByUserAndType(
      userId,
      WidgetType.overlay,
    );
    if (!widget || !widget.active) return;

    const settings = widget.settings as unknown as OverlayWidgetSettingsDto;
    const isOnline = await this.redisService.get<string>(
      RedisKeys.overlayOnline(widget.token),
    );

    this.dashboardGateway.emitOverlayStatus(
      userId,
      Boolean(isOnline),
      settings.isPaused,
    );
    await this.syncDashboardQueue(userId, widget.token);
  }

  async unregisterConnection(token: string) {
    const widget = await this.widgetRepository.findByToken(token);
    await this.redisService.remove(RedisKeys.overlayOnline(token));
    if (widget) this.dashboardGateway.emitOverlayStatus(widget.userId, false);
  }

  async updateOnlineStatus(token: string) {
    await this.redisService.setWithExpire(
      RedisKeys.overlayOnline(token),
      REDIS_TTL.overlayOnline,
      'true',
    );
  }

  // ─── Queue Orchestration ─────────────────────────────────────────────────────

  async handleNewDonation(overlay: Widget, donationId: string) {
    const isOnline = await this.redisService.get<string>(
      RedisKeys.overlayOnline(overlay.token),
    );
    if (!isOnline) return;

    await this.redisService.addToListEnd(
      RedisKeys.overlayQueue(overlay.token),
      donationId,
    );

    await this.syncDashboardQueue(overlay.userId, overlay.token);
    await this.dispatchIfReady(overlay.token);
  }

  async alertFinished(token: string, donationId: string) {
    if (!donationId.startsWith(TEST_ID_PREFIX)) {
      const updated = await this.donationsRepository.update(donationId, {
        status: 'displayed',
      });
      const historyEntity = DonationHistoryEntity.fromDonation(updated);
      this.dashboardGateway.emitDonationUpdated(updated.userId, historyEntity);
    }
    await this.redisService.remove(RedisKeys.overlayCurrent(token));
    await this.dispatchIfReady(token);
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

    const isOnline = await this.redisService.get<string>(
      RedisKeys.overlayOnline(updated.token),
    );
    this.dashboardGateway.emitOverlayStatus(
      userId,
      Boolean(isOnline),
      settings.isPaused,
    );

    if (!settings.isPaused) {
      this.overlayGateway.emitResumeAlerts(updated.token);
      await this.dispatchIfReady(updated.token);
    } else {
      this.overlayGateway.emitPauseAlerts(updated.token);
      await this.redisService.remove(RedisKeys.overlayCurrent(updated.token));
      await this.syncDashboardQueue(userId, updated.token);
    }

    return updated.settings;
  }

  async skipCurrent(userId: string) {
    const widget = await this.getActiveOverlay(userId);
    this.overlayGateway.emitSkipAlert(widget.token);
    await this.redisService.remove(RedisKeys.overlayCurrent(widget.token));

    const settings = widget.settings as unknown as OverlayWidgetSettingsDto;
    if (settings.isPaused) {
      await this.redisService.removeFromListStart(
        RedisKeys.overlayQueue(widget.token),
      );
      await this.syncDashboardQueue(userId, widget.token);
      return;
    }

    await this.dispatchNextAlert(widget.token);
  }

  async clearQueue(userId: string) {
    const widget = await this.getActiveOverlay(userId);
    await this.redisService.remove(RedisKeys.overlayQueue(widget.token));
    await this.redisService.remove(RedisKeys.overlayCurrent(widget.token));
    this.overlayGateway.emitClearAlerts(widget.token);
    this.dashboardGateway.emitQueueSync(userId, []);
  }

  async removeFromQueue(userId: string, donationId: string) {
    const widget = await this.getActiveOverlay(userId);
    const queueKey = RedisKeys.overlayQueue(widget.token);
    const currentKey = RedisKeys.overlayCurrent(widget.token);

    const current =
      await this.redisService.get<OverlayDonationEntity>(currentKey);
    if (current && current.id === donationId) {
      this.overlayGateway.emitSkipAlert(widget.token);
      await this.redisService.remove(currentKey);
      const settings = widget.settings as unknown as OverlayWidgetSettingsDto;
      if (settings.isPaused) {
        await this.syncDashboardQueue(userId, widget.token);
      } else {
        await this.dispatchNextAlert(widget.token);
      }
      return;
    }

    await this.redisService.removeListValue(queueKey, donationId);
    await this.syncDashboardQueue(userId, widget.token);
  }

  async replayDonation(userId: string, donationId: string) {
    const [widget, donation] = await Promise.all([
      this.getActiveOverlay(userId),
      this.donationsRepository.findById(donationId),
    ]);

    if (!donation || donation.userId !== userId) {
      throw new NotFoundException('Doação não encontrada');
    }

    await this.redisService.addToListEnd(
      RedisKeys.overlayQueue(widget.token),
      donationId,
    );

    await this.syncDashboardQueue(userId, widget.token);
    await this.dispatchIfReady(widget.token);
  }

  async testOverlay(userId: string) {
    const widget = await this.getActiveOverlay(userId);

    await this.redisService.addToListEnd(
      RedisKeys.overlayQueue(widget.token),
      `${TEST_ID_PREFIX}${randomUUID()}`,
    );

    await this.syncDashboardQueue(userId, widget.token);
    await this.dispatchIfReady(widget.token);
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private async getActiveOverlay(userId: string) {
    const widget = await this.widgetRepository.findByUserAndType(
      userId,
      WidgetType.overlay,
    );
    if (!widget || !widget.active)
      throw new NotFoundException('Overlay ativo não encontrado');
    return widget;
  }

  private async dispatchIfReady(token: string) {
    const widget = await this.widgetRepository.findByToken(token);
    if (!widget || !widget.active) return;

    const settings = widget.settings as unknown as OverlayWidgetSettingsDto;
    if (settings.isPaused) {
      await this.syncDashboardQueue(widget.userId, token);
      return;
    }

    const hasCurrent = await this.redisService.get<unknown>(
      RedisKeys.overlayCurrent(token),
    );
    if (hasCurrent) return;

    await this.dispatchNextAlert(token);
  }

  private buildTestDonation(id: string): OverlayDonationEntity {
    return new OverlayDonationEntity({
      id,
      name: 'LinkPix',
      amount: 8.43,
      message: 'Esta é uma notificação de teste!',
      audioUrl: null,
      messageType: null,
      createdAt: new Date(),
      isTest: true,
    });
  }

  private toOverlayPayload(donation: Donation): OverlayDonationEntity {
    return OverlayDonationEntity.toResponse(
      donation,
      getAudioUrl(donation.voiceUrl),
    );
  }

  private async resolvePayload(
    id: string,
  ): Promise<OverlayDonationEntity | null> {
    if (id.startsWith(TEST_ID_PREFIX)) return this.buildTestDonation(id);

    const donation = await this.donationsRepository.findById(id);

    return donation ? this.toOverlayPayload(donation) : null;
  }

  private async dispatchNextAlert(token: string) {
    const queueKey = RedisKeys.overlayQueue(token);
    const currentKey = RedisKeys.overlayCurrent(token);

    const widget = await this.widgetRepository.findByToken(token);

    const nextId = await this.redisService.removeFromListStart(queueKey);
    const payload = nextId ? await this.resolvePayload(nextId) : null;

    if (nextId && payload) {
      const claimed = await this.redisService.setIfNotExists(
        currentKey,
        REDIS_TTL.overlayCurrent,
        payload,
      );

      if (claimed) {
        this.overlayGateway.emitNewDonation(token, payload);
      } else {
        await this.redisService.addToListStart(queueKey, nextId);
      }
    }

    if (widget) await this.syncDashboardQueue(widget.userId, token);
  }

  private async resendCurrentAlert(token: string) {
    const key = RedisKeys.overlayCurrent(token);
    const payload = await this.redisService.get<OverlayDonationEntity>(key);

    if (!payload) {
      await this.redisService.remove(key);
      return;
    }

    this.overlayGateway.emitNewDonation(token, payload);
  }

  private async syncDashboardQueue(userId: string, token: string) {
    const queueKey = RedisKeys.overlayQueue(token);

    const [rawEntries, currentPayload] = await Promise.all([
      this.redisService.getListRange(queueKey, 0, -1),
      this.redisService.get<OverlayDonationEntity>(
        RedisKeys.overlayCurrent(token),
      ),
    ]);

    const donationIds = rawEntries.filter(
      (raw) => !raw.startsWith(TEST_ID_PREFIX),
    );
    const testIds = rawEntries.filter((raw) => raw.startsWith(TEST_ID_PREFIX));

    const donations = donationIds.length
      ? await this.donationsRepository.findManyByIds(donationIds)
      : [];
    const donationMap = new Map(donations.map((d) => [d.id, d]));

    const staleIds = donationIds.filter((id) => !donationMap.has(id));
    if (staleIds.length > 0) {
      await Promise.all(
        staleIds.map((id) => this.redisService.removeListValue(queueKey, id)),
      );
    }

    const pending: OverlayDonationEntity[] = [
      ...donationIds
        .filter((id) => donationMap.has(id))
        .map((id) => this.toOverlayPayload(donationMap.get(id)!)),
      ...testIds.map((id) => this.buildTestDonation(id)),
    ];

    let queue = pending;

    if (
      currentPayload &&
      typeof currentPayload === 'object' &&
      typeof currentPayload.id === 'string'
    ) {
      const currentEntity = new OverlayDonationEntity({
        ...currentPayload,
        isCurrent: true,
      });
      queue = [currentEntity, ...pending];
    }

    this.dashboardGateway.emitQueueSync(userId, queue);
  }
}

import {
  GoneException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Donation, DonationStatus, Widget, WidgetType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { getStorageUrl } from 'src/common/utils/storageUrl.util';
import { isOlderThanRetention } from 'src/common/utils/history-retention.util';
import { DonationsRepository } from 'src/infra/db/repositories/donations.repositories';
import { VoicesRepository } from 'src/infra/db/repositories/voices.repositories';
import { WidgetRepository } from 'src/infra/db/repositories/widget.repositories';
import { REDIS_TTL, RedisKeys } from 'src/infra/redis/redis-keys';
import { RedisService } from 'src/infra/redis/redis.service';
import { SpeechContract } from 'src/infra/speech/contract/speech.contract';
import { StorageContract } from 'src/infra/storage/contract/storage.contract';
import { DashboardGateway } from 'src/infra/websocket/dashboard.gateway';
import { OverlayGateway } from 'src/infra/websocket/overlay.gateway';
import { OverlayDonationEntity } from 'src/modules/donations/entities/overlay-donation.entity';
import { DonationHistoryEntity } from '../donations/entities/donation-history.entity';
import { PersistedOverlaySettings } from './dto/overlay-settings.dto';
import { getWidgetDefaults } from './widget-defaults';

const TEST_ID_PREFIX = 'test-';
const TEST_TTS_MESSAGE = 'Esta é uma notificação de teste!';

@Injectable()
export class OverlayService {
  private readonly logger = new Logger(OverlayService.name);
  private readonly testAudioUrlCache = new Map<string, string>();

  constructor(
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => OverlayGateway))
    private readonly overlayGateway: OverlayGateway,
    @Inject(forwardRef(() => DashboardGateway))
    private readonly dashboardGateway: DashboardGateway,
    private readonly widgetRepository: WidgetRepository,
    private readonly donationsRepository: DonationsRepository,
    private readonly storage: StorageContract,
    private readonly speech: SpeechContract,
    private readonly voicesRepository: VoicesRepository,
    private readonly configService: ConfigService,
  ) {}

  // ─── Overlay Connection ──────────────────────────────────────────────────────

  async registerConnection(token: string) {
    const widget = await this.widgetRepository.findByTokenAndType(
      token,
      WidgetType.overlay,
    );
    if (!widget || !widget.active) return false;

    const settings = widget.settings as unknown as PersistedOverlaySettings;

    await this.updateOnlineStatus(token);
    this.dashboardGateway.emitOverlayStatus(
      widget.userId,
      true,
      settings.isPaused,
    );
    await this.resendCurrentAlert(token);
    await this.dispatchIfReady(token);
    await this.syncDashboardQueue(widget.userId, token);
    return true;
  }

  async emitDashboardState(userId: string) {
    const widget = await this.widgetRepository.findByUserAndType(
      userId,
      WidgetType.overlay,
    );
    if (!widget || !widget.active) return;

    const settings = widget.settings as unknown as PersistedOverlaySettings;
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
    const widget = await this.widgetRepository.findByTokenAndType(
      token,
      WidgetType.overlay,
    );
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

  notifySettingsUpdated(token: string) {
    this.overlayGateway.emitSettingsUpdated(token);
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
    const widget = await this.widgetRepository.findByTokenAndType(
      token,
      WidgetType.overlay,
    );
    if (!widget?.active) return;

    const currentKey = RedisKeys.overlayCurrent(token);
    const current =
      await this.redisService.get<OverlayDonationEntity>(currentKey);
    if (!current || current.id !== donationId) return;

    let updated: Donation | null = null;
    if (!donationId.startsWith(TEST_ID_PREFIX)) {
      updated = await this.donationsRepository.markAsDisplayedIfOwnedAndSettled(
        donationId,
        widget.userId,
      );
      if (!updated) return;

      const historyEntity = DonationHistoryEntity.fromDonation(updated);
      this.dashboardGateway.emitDonationUpdated(updated.userId, historyEntity);
    }

    const removed = await this.redisService.removeIfValueMatches(
      currentKey,
      current,
    );
    if (!removed) return;

    await this.dispatchIfReady(token);
  }

  // ─── Dashboard Actions (called from OverlayController via HTTP) ───────────────

  async togglePause(userId: string) {
    const widget = await this.getOrCreateActiveOverlay(userId);

    const settings = widget.settings as unknown as PersistedOverlaySettings;
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
    const widget = await this.getOrCreateActiveOverlay(userId);
    this.overlayGateway.emitSkipAlert(widget.token);
    await this.redisService.remove(RedisKeys.overlayCurrent(widget.token));

    const settings = widget.settings as unknown as PersistedOverlaySettings;
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
    const widget = await this.getOrCreateActiveOverlay(userId);
    await this.redisService.remove(RedisKeys.overlayQueue(widget.token));
    await this.redisService.remove(RedisKeys.overlayCurrent(widget.token));
    this.overlayGateway.emitClearAlerts(widget.token);
    this.dashboardGateway.emitQueueSync(userId, []);
  }

  async removeFromQueue(userId: string, donationId: string) {
    const widget = await this.getOrCreateActiveOverlay(userId);
    const queueKey = RedisKeys.overlayQueue(widget.token);
    const currentKey = RedisKeys.overlayCurrent(widget.token);

    const current =
      await this.redisService.get<OverlayDonationEntity>(currentKey);
    if (current && current.id === donationId) {
      this.overlayGateway.emitSkipAlert(widget.token);
      await this.redisService.remove(currentKey);
      const settings = widget.settings as unknown as PersistedOverlaySettings;
      if (settings.isPaused) {
        await this.syncDashboardQueue(userId, widget.token);
      } else {
        await this.dispatchNextAlert(widget.token);
      }
      return;
    }

    await this.redisService.removeListValueOnce(queueKey, donationId);
    await this.syncDashboardQueue(userId, widget.token);
  }

  async replayDonation(userId: string, donationId: string) {
    const donation = await this.donationsRepository.findById(donationId);

    if (
      !donation ||
      donation.userId !== userId ||
      (donation.status !== DonationStatus.paid &&
        donation.status !== DonationStatus.displayed)
    ) {
      throw new NotFoundException('Doação não encontrada');
    }

    if (isOlderThanRetention(donation.createdAt)) {
      throw new GoneException(
        'Doação expirada. Doações ficam disponíveis por 30 dias.',
      );
    }

    const widget = await this.getOrCreateActiveOverlay(userId);

    await this.redisService.addToListEnd(
      RedisKeys.overlayQueue(widget.token),
      donationId,
    );

    await this.syncDashboardQueue(userId, widget.token);
    await this.dispatchIfReady(widget.token);
  }

  async testOverlay(userId: string) {
    const widget = await this.getOrCreateActiveOverlay(userId);

    await this.redisService.addToListEnd(
      RedisKeys.overlayQueue(widget.token),
      `${TEST_ID_PREFIX}${randomUUID()}`,
    );

    await this.syncDashboardQueue(userId, widget.token);
    await this.dispatchIfReady(widget.token);
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private async getOrCreateActiveOverlay(userId: string) {
    const widget = await this.widgetRepository.findByUserAndType(
      userId,
      WidgetType.overlay,
    );
    if (widget) {
      if (!widget.active)
        throw new NotFoundException('Overlay ativo não encontrado');
      return widget;
    }
    return await this.widgetRepository.upsert(userId, {
      type: WidgetType.overlay,
      settings: getWidgetDefaults(WidgetType.overlay) as unknown as Record<
        string,
        any
      >,
    });
  }

  private async dispatchIfReady(token: string) {
    const widget = await this.widgetRepository.findByTokenAndType(
      token,
      WidgetType.overlay,
    );
    if (!widget || !widget.active) return;

    const settings = widget.settings as unknown as PersistedOverlaySettings;
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

  private async buildTestDonation(id: string): Promise<OverlayDonationEntity> {
    return new OverlayDonationEntity({
      id,
      name: 'LinkPix',
      amount: 8.43,
      message: TEST_TTS_MESSAGE,
      audioUrl: await this.resolveTestAudioUrl(),
      messageType: null,
      createdAt: new Date(),
      isTest: true,
    });
  }

  private async resolveTestAudioUrl(): Promise<string | null> {
    const systemVoiceId = this.configService.get<string>('DEFAULT_VOICE_ID');
    if (!systemVoiceId) return null;

    const cached = this.testAudioUrlCache.get(systemVoiceId);
    if (cached) return cached;

    try {
      const voice = await this.voicesRepository.findById(systemVoiceId);
      const isGoogle = (voice?.provider ?? '').toLowerCase() === 'google';
      const key = `tts/test-${systemVoiceId}.${isGoogle ? 'mp3' : 'wav'}`;
      if (!(await this.storage.exists(key))) {
        const tts = await this.speech.generateTTS({
          message: TEST_TTS_MESSAGE,
          voice: voice?.voiceId ?? null,
          provider: voice?.provider ?? null,
        });
        await this.storage.upload(
          tts,
          key,
          isGoogle ? 'audio/mpeg' : 'audio/wav',
        );
      }
      const url = getStorageUrl(key);
      if (url) this.testAudioUrlCache.set(systemVoiceId, url);
      return url;
    } catch (error) {
      this.logger.warn(
        `Áudio de teste indisponível; exibindo teste sem som. ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async toOverlayPayload(
    donation: Donation,
  ): Promise<OverlayDonationEntity> {
    return OverlayDonationEntity.toResponse(
      donation,
      await this.resolveAudioUrl(donation.voiceUrl),
    );
  }

  private async resolveAudioUrl(
    voiceUrl: string | null,
  ): Promise<string | null> {
    if (!voiceUrl) return null;
    try {
      const exists = await this.storage.exists(voiceUrl);
      if (!exists) {
        this.logger.warn(
          `Áudio ${voiceUrl} ausente no storage; exibindo alerta sem som`,
        );
        return null;
      }
      return getStorageUrl(voiceUrl);
    } catch (error) {
      this.logger.warn(
        `Falha ao verificar áudio ${voiceUrl}; mantendo URL. ${error instanceof Error ? error.message : String(error)}`,
      );
      return getStorageUrl(voiceUrl);
    }
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

    const widget = await this.widgetRepository.findByTokenAndType(
      token,
      WidgetType.overlay,
    );

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
      ...(await Promise.all(
        donationIds
          .filter((id) => donationMap.has(id))
          .map((id) => this.toOverlayPayload(donationMap.get(id)!)),
      )),
      ...(await Promise.all(testIds.map((id) => this.buildTestDonation(id)))),
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

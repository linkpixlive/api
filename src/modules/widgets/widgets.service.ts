import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WidgetType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { VoicesRepository } from 'src/infra/db/repositories/voices.repositories';
import { WidgetRepository } from 'src/infra/db/repositories/widget.repositories';
import { RedisKeys } from 'src/infra/redis/redis-keys';
import { RedisService } from 'src/infra/redis/redis.service';
import {
  OverlayWidgetSettingsDto,
  PersistedOverlaySettings,
} from './dto/overlay-settings.dto';
import { WidgetSettingsMap } from './dto/widget-settings.map';
import { WidgetEntity } from './entities/widget.entity';
import { OverlayService } from './overlay.service';
import { getWidgetDefaults } from './widget-defaults';

@Injectable()
export class WidgetsService {
  constructor(
    private readonly widgetRepository: WidgetRepository,
    private readonly redisService: RedisService,
    private readonly overlayService: OverlayService,
    private readonly voicesRepository: VoicesRepository,
  ) {}

  async getWidgetSettings<T extends WidgetType>(
    userId: string,
    type: T,
  ): Promise<WidgetEntity<T>> {
    const widget = await this.widgetRepository.findByUserAndType(userId, type);

    if (!widget)
      throw new NotFoundException('Configurações do widget não encontradas');

    return WidgetEntity.fromPrisma<T>(widget);
  }

  async upsertWidgetSettings<T extends WidgetType>(
    userId: string,
    type: T,
    settings?: WidgetSettingsMap[T],
  ): Promise<WidgetEntity<T>> {
    let merged = settings;

    if (type === WidgetType.overlay && settings) {
      const overlaySettings = settings as unknown as OverlayWidgetSettingsDto;
      if (overlaySettings.defaultNarrator?.trim()) {
        const voice = await this.voicesRepository.findById(
          overlaySettings.defaultNarrator,
        );
        if (!voice || !voice.isActive) {
          throw new BadRequestException(
            'Voz padrão não encontrada ou indisponível',
          );
        }
      }

      const existing = await this.widgetRepository.findByUserAndType(
        userId,
        type,
      );
      const prevPaused =
        (existing?.settings as unknown as PersistedOverlaySettings | undefined)
          ?.isPaused ?? false;
      merged = {
        ...(settings as unknown as OverlayWidgetSettingsDto),
        isPaused: prevPaused,
      } as unknown as WidgetSettingsMap[T];
    }

    const widget = await this.widgetRepository.upsert(userId, {
      type,
      settings: (merged ?? getWidgetDefaults(type)) as unknown as Record<
        string,
        any
      >,
    });

    if (type === WidgetType.overlay) {
      this.overlayService.notifySettingsUpdated(widget.token);
    }

    return WidgetEntity.fromPrisma<T>(widget);
  }

  async getPublicWidgetSettings<T extends WidgetType>(token: string) {
    const widget = await this.widgetRepository.findByToken(token);
    if (!widget) throw new NotFoundException('Widget não encontrado');

    return WidgetEntity.fromPrisma<T>(widget);
  }

  async resetToken(
    userId: string,
    type: WidgetType,
  ): Promise<WidgetEntity<any>> {
    const existingWidget = await this.widgetRepository.findByUserAndType(
      userId,
      type,
    );

    if (!existingWidget) {
      throw new NotFoundException('Widget não encontrado');
    }

    const widget = await this.widgetRepository.updateToken(
      userId,
      type,
      randomUUID(),
    );

    if (existingWidget.token !== widget.token) {
      await Promise.all([
        this.redisService.remove(RedisKeys.overlayQueue(existingWidget.token)),
        this.redisService.remove(
          RedisKeys.overlayCurrent(existingWidget.token),
        ),
        this.redisService.remove(RedisKeys.overlayOnline(existingWidget.token)),
      ]);
    }

    return WidgetEntity.fromPrisma(widget);
  }
}

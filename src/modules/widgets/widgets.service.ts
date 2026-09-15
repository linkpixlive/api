import { Injectable, NotFoundException } from '@nestjs/common';
import { WidgetType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { WidgetRepository } from 'src/infra/db/repositories/widget.repositories';
import { RedisKeys } from 'src/infra/redis/redis-keys';
import { RedisService } from 'src/infra/redis/redis.service';
import { WidgetSettingsMap } from './dto/widget-settings.map';
import { WidgetEntity } from './entities/widget.entity';
import { getWidgetDefaults } from './widget-defaults';

@Injectable()
export class WidgetsService {
  constructor(
    private readonly widgetRepository: WidgetRepository,
    private readonly redisService: RedisService,
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
    const widget = await this.widgetRepository.upsert(userId, {
      type,
      settings: (settings ?? getWidgetDefaults(type)) as unknown as Record<
        string,
        any
      >,
    });

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

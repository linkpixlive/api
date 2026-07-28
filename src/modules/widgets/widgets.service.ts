import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WidgetType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { WidgetRepository } from 'src/infra/db/repositories/widget.repositories';
import { SafeUser } from '../auth/entities/safe-user.entity';
import { WidgetSettingsMap } from './dto/widget-settings.map';
import { WidgetEntity } from './entities/widget.entity';

@Injectable()
export class WidgetsService {
  constructor(private readonly widgetRepository: WidgetRepository) {}

  async getWidgetSettings<T extends WidgetType>(
    userId: string,
    type: T,
  ): Promise<WidgetEntity<T>> {
    const widget = await this.widgetRepository.findByUserAndType(userId, type);

    if (!widget)
      throw new NotFoundException('Configurações do widget não encontradas');

    return WidgetEntity.fromPrisma<T>(widget);
  }

  async createWidgetSettings<T extends WidgetType>(
    userId: string,
    type: T,
    settings?: WidgetSettingsMap[T],
  ): Promise<WidgetEntity<T>> {
    const existingWidget = await this.widgetRepository.findByUserAndType(
      userId,
      type,
    );

    if (existingWidget) {
      throw new ConflictException('Configurações do widget já existem');
    }

    const widget = await this.widgetRepository.create(userId, {
      type,
      settings: settings ?? this.getDefaultSettings(type),
    });

    return WidgetEntity.fromPrisma<T>(widget);
  }

  async updateWidgetSettings<T extends WidgetType>(
    user: SafeUser,
    type: T,
    settings: WidgetSettingsMap[T],
  ): Promise<WidgetEntity<T>> {
    const existingWidget = await this.widgetRepository.findByUserAndType(
      user.id,
      type,
    );

    if (!existingWidget) {
      throw new NotFoundException('Configurações do widget não encontradas');
    }

    const widget = await this.widgetRepository.update(user.id, {
      type,
      settings,
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

    return WidgetEntity.fromPrisma(widget);
  }

  private getDefaultSettings(type: WidgetType): Record<string, any> {
    switch (type) {
      case WidgetType.overlay:
        return {
          volume: 100,
          speakNameAmount: true,
          defaultNarrator: 'Ricardo',
          isPaused: false,
        };
      case WidgetType.qrcode:
        return {
          color: '#000000',
          size: 256,
        };
      default:
        return {};
    }
  }
}

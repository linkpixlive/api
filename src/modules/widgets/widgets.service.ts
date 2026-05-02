import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WidgetType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { WidgetRepository } from 'src/infra/db/repositories/widget.repositories';
import { OverlayGateway } from 'src/infra/websocket/overlay.gateway';
import { SafeUser } from '../auth/entities/safe-user.entity';
import { WidgetEntity } from './entities/widget.entity';

import { WidgetSettingsMap } from './dto/widget-settings.map';

@Injectable()
export class WidgetsService {
  constructor(
    private readonly widgetRepository: WidgetRepository,
    private readonly usersRepository: UsersRepository,
    private readonly overlayGateway: OverlayGateway,
  ) {}

  async getWidgetSettings<T extends WidgetType>(
    userId: string,
    type: T,
  ): Promise<WidgetEntity<T>> {
    const widget = await this.widgetRepository.findByUserAndType(userId, type);

    if (!widget) throw new NotFoundException('Widget settings not found');

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
      throw new ConflictException('Widget settings already exist');
    }

    const widget = await this.widgetRepository.create(userId, {
      type,
      settings:
        type === WidgetType.overlay
          ? settings || this.getDefaultSettings(type)
          : this.getDefaultSettings(type),
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
      throw new NotFoundException('Widget settings not found');
    }

    const widget = await this.widgetRepository.update(user.id, {
      type,
      settings,
    });

    if (type === WidgetType.overlay) {
      this.overlayGateway.emitSettingsUpdated(widget.token);
    }

    return WidgetEntity.fromPrisma<T>(widget);
  }

  async getPublicWidgetSettings<T extends WidgetType>(
    token: string,
    type: T,
  ): Promise<WidgetSettingsMap[T]> {
    const widget = await this.widgetRepository.findByToken(token);
    if (!widget) throw new NotFoundException('Widget not found');

    if (widget.type !== type) throw new NotFoundException('Settings not found');

    return widget.settings as WidgetSettingsMap[T];
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
      throw new NotFoundException('Widget not found');
    }

    const widget = await this.widgetRepository.updateToken(
      userId,
      type,
      randomUUID(),
    );

    return WidgetEntity.fromPrisma(widget);
  }

  async testOverlay(userId: string) {
    const overlay = await this.widgetRepository.findByUserAndType(
      userId,
      WidgetType.overlay,
    );
    if (!overlay || !overlay.active)
      throw new NotFoundException('Active overlay not found');

    this.overlayGateway.emitTestNotification(overlay.token);
    return;
  }

  private getDefaultSettings(type: WidgetType): Record<string, any> {
    switch (type) {
      case WidgetType.overlay:
        return {
          volume: 100,
          speakNameAmount: true,
          defaultNarrator: 'Ricardo',
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

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WidgetType } from '@prisma/client';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { WidgetRepository } from 'src/infra/db/repositories/widget.repositories';
import { OverlayGateway } from 'src/infra/websocket/overlay.gateway';
import { SafeUser } from '../auth/entities/safe-user.entity';

import { WidgetSettingsMap } from './dto/widget-settings.map';

@Injectable()
export class WidgetsService {
  constructor(
    private readonly widgetRepository: WidgetRepository,
    private readonly usersRepository: UsersRepository,
    private readonly overlayGateway: OverlayGateway,
  ) {}

  async getWidgetSettings<T extends WidgetType>(userId: string, type: T) {
    const widget = await this.widgetRepository.findByUserAndType(userId, type);

    if (!widget) throw new NotFoundException('Widget settings not found');

    return widget.settings as WidgetSettingsMap[T];
  }

  async createWidgetSettings<T extends WidgetType>(
    userId: string,
    type: T,
    settings?: WidgetSettingsMap[T],
  ) {
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

    return widget.settings as WidgetSettingsMap[T];
  }

  async updateWidgetSettings<T extends WidgetType>(
    user: SafeUser,
    type: T,
    settings: WidgetSettingsMap[T],
  ) {
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
      this.overlayGateway.emitSettingsUpdated(user.overlayKey);
    }

    return widget.settings as WidgetSettingsMap[T];
  }

  async getPublicWidgetSettings<T extends WidgetType>(key: string, type: T) {
    const user = await this.usersRepository.findByOverlayKey(key);
    if (!user) throw new NotFoundException('Widget not found');

    const widget = await this.widgetRepository.findByUserAndType(user.id, type);
    if (!widget) throw new NotFoundException('Settings not found');

    return widget.settings as WidgetSettingsMap[T];
  }

  async testOverlay(userId: string) {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    this.overlayGateway.emitTestNotification(user.overlayKey);
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

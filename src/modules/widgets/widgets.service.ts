import { Injectable, NotFoundException } from '@nestjs/common';
import { WidgetType } from '@prisma/client';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';
import { WidgetRepository } from 'src/infra/db/repositories/widget.repositories';
import { OverlayGateway } from 'src/infra/websocket/overlay.gateway';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import { WidgetEntity } from './entities/widget.entity';

export interface OverlayWidgetSettings {
  volume: number;
  speakNameAmount: boolean;
  defaultNarrator: string;
}

@Injectable()
export class WidgetsService {
  constructor(
    private readonly widgetRepository: WidgetRepository,
    private readonly usersRepository: UsersRepository,
    private readonly overlayGateway: OverlayGateway,
  ) {}

  async getWidgetSettings(
    userId: string,
    type: WidgetType,
  ): Promise<WidgetEntity> {
    const widget = await this.widgetRepository.findByUserAndType(userId, type);

    if (!widget) {
      const newWidget = await this.widgetRepository.upsert(userId, {
        type,
        settings: this.getDefaultSettings(type),
      });

      return new WidgetEntity({
        ...newWidget,
        settings: newWidget.settings as Record<string, any>,
      });
    }

    return new WidgetEntity({
      ...widget,
      settings: widget.settings as Record<string, any>,
    });
  }

  async updateWidgetSettings(
    userId: string,
    type: WidgetType,
    data: UpdateWidgetDto,
  ): Promise<WidgetEntity> {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const widget = await this.widgetRepository.upsert(userId, {
      type,
      settings: data.settings || {},
      active: data.active,
    });

    if (type === WidgetType.overlay) {
      this.overlayGateway.emitSettingsUpdated(user.overlayKey, widget.settings);
    }

    return new WidgetEntity({
      ...widget,
      settings: widget.settings as Record<string, any>,
    });
  }

  async getPublicWidgetSettings(
    key: string,
    type: WidgetType,
  ): Promise<WidgetEntity> {
    const user = await this.usersRepository.findByOverlayKey(key);
    if (!user) throw new NotFoundException('Widget not found');

    const widget = await this.widgetRepository.findByUserAndType(user.id, type);
    if (!widget) throw new NotFoundException('Settings not found');

    return new WidgetEntity({
      ...widget,
      settings: widget.settings as Record<string, any>,
    });
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

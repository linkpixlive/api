import { WidgetType } from '@prisma/client';
import { ClassConstructor } from 'class-transformer';
import { OverlayWidgetSettingsDto } from './overlay-settings.dto';
import { QrCodeWidgetSettingsDto } from './qrcode-settings.dto';

export const WIDGET_DTO_MAP = {
  [WidgetType.overlay]: OverlayWidgetSettingsDto,
  [WidgetType.qrcode]: QrCodeWidgetSettingsDto,
} satisfies Record<WidgetType, ClassConstructor<unknown>>;

export type WidgetSettingsMap = {
  [K in keyof typeof WIDGET_DTO_MAP]: InstanceType<(typeof WIDGET_DTO_MAP)[K]>;
};

export type AnyWidgetSettings = WidgetSettingsMap[keyof WidgetSettingsMap];

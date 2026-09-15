import { WidgetType } from '@prisma/client';
import { WidgetSettingsMap } from './dto/widget-settings.map';

export const WIDGET_DEFAULTS: {
  [K in WidgetType]: WidgetSettingsMap[K];
} = {
  [WidgetType.overlay]: {
    volume: 100,
    speakNameAmount: true,
    defaultNarrator: 'Ricardo',
    isPaused: false,
  },
  [WidgetType.qrcode]: {
    color: '#000000',
    size: 256,
  },
};

export function getWidgetDefaults<T extends WidgetType>(
  type: T,
): WidgetSettingsMap[T] {
  return { ...WIDGET_DEFAULTS[type] };
}

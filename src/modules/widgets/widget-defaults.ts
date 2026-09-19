import { WidgetType } from '@prisma/client';
import { PersistedOverlaySettings } from './dto/overlay-settings.dto';
import { WidgetSettingsMap } from './dto/widget-settings.map';

type WidgetDefaultsMap = {
  overlay: PersistedOverlaySettings;
  qrcode: WidgetSettingsMap['qrcode'];
};

export const WIDGET_DEFAULTS: WidgetDefaultsMap = {
  [WidgetType.overlay]: {
    volume: 100,
    speakNameAmount: true,
    defaultNarrator: '',
    audioOnly: false,
    isPaused: false,
  },
  [WidgetType.qrcode]: {
    color: '#000000',
    size: 256,
  },
};

export function getWidgetDefaults<T extends WidgetType>(
  type: T,
): WidgetDefaultsMap[T] {
  return { ...WIDGET_DEFAULTS[type] };
}

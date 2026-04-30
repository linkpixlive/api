import { WidgetType } from '@prisma/client';

export interface CreateWidgetParams {
  type: WidgetType;
  settings: Record<string, any>;
}

export interface UpdateWidgetParams {
  type: WidgetType;
  settings: Record<string, any>;
}

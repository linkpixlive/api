import { WidgetType } from '@prisma/client';

export interface UpsertWidgetParams {
  type: WidgetType;
  settings: Record<string, any>;
  active?: boolean;
}

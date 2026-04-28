import { Widget, WidgetType } from '@prisma/client';

export class WidgetEntity implements Widget {
  id: string;
  type: WidgetType;
  settings: Record<string, any>;
  active: boolean;
  userId: string;
  updatedAt: Date;

  constructor(partial: Partial<WidgetEntity>) {
    Object.assign(this, partial);
  }
}

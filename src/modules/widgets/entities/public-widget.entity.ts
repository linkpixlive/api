import { ApiProperty } from '@nestjs/swagger';
import { Widget, WidgetType } from '@prisma/client';
import { Exclude, Expose, Type } from 'class-transformer';
import type { AnyWidgetSettings } from '../dto/widget-settings.map';

@Exclude()
export class PublicWidgetEntity {
  @ApiProperty({ enum: WidgetType })
  @Expose()
  type: WidgetType;

  @ApiProperty()
  @Expose()
  active: boolean;

  @ApiProperty()
  @Expose()
  @Type(() => Object)
  settings: AnyWidgetSettings;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<PublicWidgetEntity>) {
    Object.assign(this, partial);
  }

  static fromPrisma(widget: Widget): PublicWidgetEntity {
    return new PublicWidgetEntity({
      type: widget.type,
      active: widget.active,
      settings: widget.settings as unknown as AnyWidgetSettings,
      updatedAt: widget.updatedAt,
    });
  }
}

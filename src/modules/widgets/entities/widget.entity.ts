import { ApiProperty } from '@nestjs/swagger';
import { Widget, WidgetType } from '@prisma/client';
import { Exclude, Expose, Type } from 'class-transformer';
import { WidgetSettingsMap } from '../dto/widget-settings.map';

@Exclude()
export class WidgetEntity<T extends WidgetType> {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6' })
  @Expose()
  token: string;

  @ApiProperty({ enum: WidgetType })
  @Expose()
  type: T;

  @ApiProperty()
  @Expose()
  active: boolean;

  @ApiProperty()
  @Expose()
  @Type(() => Object)
  settings: WidgetSettingsMap[T];

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<WidgetEntity<T>>) {
    Object.assign(this, partial);
  }

  static fromPrisma<T extends WidgetType>(
    widget: Widget & { token: string },
  ): WidgetEntity<T> {
    return new WidgetEntity<T>({
      token: widget.token,
      type: widget.type as T,
      active: widget.active,
      settings: widget.settings as WidgetSettingsMap[T],
      updatedAt: widget.updatedAt,
    });
  }
}

import { WidgetType } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class WidgetTypeParams {
  @IsEnum(WidgetType, {
    message: `Invalid widget type. Allowed values: ${Object.values(WidgetType).join(', ')}`,
  })
  type: WidgetType;
}

export class PublicWidgetParams extends WidgetTypeParams {
  @IsString()
  token: string;
}

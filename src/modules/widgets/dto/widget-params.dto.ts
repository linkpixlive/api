import { WidgetType } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class WidgetTypeParams {
  @IsEnum(WidgetType, {
    message: `Tipo de widget inválido. Valores permitidos: ${Object.values(WidgetType).join(', ')}`,
  })
  type: WidgetType;
}

export class PublicWidgetParams {
  @IsUUID('4', { message: 'token deve ser um UUID v4 válido' })
  token: string;
}

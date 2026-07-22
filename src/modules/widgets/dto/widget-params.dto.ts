import { WidgetType } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class WidgetTypeParams {
  @IsEnum(WidgetType, {
    message: `Tipo de widget inválido. Valores permitidos: ${Object.values(WidgetType).join(', ')}`,
  })
  type: WidgetType;
}

export class PublicWidgetParams {
  @IsString({ message: 'token deve ser uma string' })
  token: string;
}

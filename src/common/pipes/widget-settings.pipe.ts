import {
  ArgumentMetadata,
  BadRequestException,
  Inject,
  Injectable,
  PipeTransform,
  Scope,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { WidgetType } from '@prisma/client';
import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Request } from 'express';
import { WIDGET_DTO_MAP } from 'src/modules/widgets/dto/widget-settings.map';

@Injectable({ scope: Scope.REQUEST })
export class WidgetSettingsPipe implements PipeTransform {
  constructor(@Inject(REQUEST) private readonly request: Request) {}

  async transform(
    value: unknown,
    { type: metadataType }: ArgumentMetadata,
  ): Promise<unknown> {
    if (metadataType !== 'body' || !value) return value;

    const params = this.request.params as Record<string, string>;
    const widgetType = params.type as WidgetType;
    const DtoClass = WIDGET_DTO_MAP[widgetType];

    if (!DtoClass) return value;

    const instance = plainToInstance(
      DtoClass as ClassConstructor<unknown>,
      value,
      {
        enableImplicitConversion: true,
      },
    );

    const errors = await validate(instance as object, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      const messages = errors.flatMap((error) =>
        Object.values(error.constraints || {}),
      );
      throw new BadRequestException(messages);
    }

    return instance;
  }
}

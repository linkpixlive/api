import { Injectable } from '@nestjs/common';
import { WidgetType } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { UpsertWidgetParams } from './dto/widget.dto';

@Injectable()
export class WidgetRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserAndType(userId: string, type: WidgetType) {
    return await this.prisma.widget.findUnique({
      where: {
        userId_type: {
          userId,
          type,
        },
      },
    });
  }

  async upsert(userId: string, data: UpsertWidgetParams) {
    return await this.prisma.widget.upsert({
      where: {
        userId_type: {
          userId,
          type: data.type,
        },
      },
      update: {
        settings: data.settings,
        active: data.active,
      },
      create: {
        userId,
        type: data.type,
        settings: data.settings,
        active: data.active,
      },
    });
  }
}

import { Injectable } from '@nestjs/common';
import { WidgetType } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateWidgetParams, UpdateWidgetParams } from './dto/widget.dto';

@Injectable()
export class WidgetRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByToken(token: string) {
    return await this.prisma.widget.findUnique({
      where: { token },
      include: { user: true },
    });
  }

  async findActiveByUserIdAndType(userId: string, type: WidgetType) {
    return await this.prisma.widget.findMany({
      where: { userId, type, active: true },
    });
  }

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

  async create(userId: string, data: CreateWidgetParams) {
    return await this.prisma.widget.create({
      data: {
        userId,
        type: data.type,
        settings: data.settings,
      },
    });
  }

  async update(userId: string, data: UpdateWidgetParams) {
    return await this.prisma.widget.update({
      where: {
        userId_type: {
          userId,
          type: data.type,
        },
      },
      data: {
        settings: data.settings,
      },
    });
  }

  async updateToken(userId: string, type: WidgetType, token: string) {
    return await this.prisma.widget.update({
      where: {
        userId_type: {
          userId,
          type,
        },
      },
      data: {
        token,
      },
    });
  }
}

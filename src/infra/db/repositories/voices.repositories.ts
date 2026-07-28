import { Injectable } from '@nestjs/common';
import { Voice } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateVoiceParams, UpdateVoiceParams } from './dto/voices.dto';

@Injectable()
export class VoicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Voice[]> {
    return await this.prisma.voice.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<Voice | null> {
    return await this.prisma.voice.findUnique({ where: { id } });
  }

  async findActive(): Promise<Voice[]> {
    return await this.prisma.voice.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: CreateVoiceParams): Promise<Voice> {
    return await this.prisma.voice.create({ data });
  }

  async update(id: string, data: UpdateVoiceParams): Promise<Voice> {
    return await this.prisma.voice.update({ where: { id }, data });
  }

  async remove(id: string): Promise<Voice> {
    return await this.prisma.voice.delete({ where: { id } });
  }
}

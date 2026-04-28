import { Injectable } from '@nestjs/common';
import { DonationSettings } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { UpsertDonationSettingsParams } from './dto/donation-settings.dto';

@Injectable()
export class DonationSettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<DonationSettings | null> {
    return await this.prisma.donationSettings.findUnique({
      where: { userId: userId },
    });
  }

  async upsert(
    userId: string,
    data: UpsertDonationSettingsParams,
  ): Promise<DonationSettings> {
    return await this.prisma.donationSettings.upsert({
      where: { userId: userId },
      update: data,
      create: {
        userId: userId,
        ...data,
      },
    });
  }
}

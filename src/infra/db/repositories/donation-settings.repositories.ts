import { Injectable } from '@nestjs/common';
import { DonationSettings } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { UpdateDonationSettingsParams } from './dto/donation-settings.dto';

@Injectable()
export class DonationSettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<DonationSettings | null> {
    return await this.prisma.donationSettings.findUnique({
      where: { userId: userId },
    });
  }

  async update(
    userId: string,
    data: UpdateDonationSettingsParams,
  ): Promise<DonationSettings> {
    return await this.prisma.donationSettings.update({
      where: { userId: userId },
      data,
    });
  }
}

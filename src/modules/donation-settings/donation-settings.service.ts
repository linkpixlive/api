import { Injectable } from '@nestjs/common';
import { DonationSettingsRepository } from 'src/infra/db/repositories/donation-settings.repositories';
import { UpdateDonationSettingsDto } from './dto/update-donation-settings.dto';
import { DonationSettingsEntity } from './entities/donation-settings.entity';

@Injectable()
export class DonationSettingsService {
  constructor(
    private readonly donationSettingsRepository: DonationSettingsRepository,
  ) {}

  async getSettings(userId: string): Promise<DonationSettingsEntity> {
    const settings = await this.donationSettingsRepository.findByUserId(userId);

    if (!settings) {
      const newSettings = await this.donationSettingsRepository.upsert(
        userId,
        {},
      );
      return new DonationSettingsEntity(newSettings);
    }
    return new DonationSettingsEntity(settings);
  }

  async updateSettings(userId: string, data: UpdateDonationSettingsDto) {
    const settings = await this.donationSettingsRepository.upsert(userId, data);

    return new DonationSettingsEntity(settings);
  }
}

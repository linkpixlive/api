import { Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/client';
import { DonationSettingsRepository } from 'src/infra/db/repositories/donation-settings.repositories';
import { UpdateDonationSettingsParams } from 'src/infra/db/repositories/dto/donation-settings.dto';
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
      throw new NotFoundException(
        'Configurações de doação não encontradas para este usuário',
      );
    }

    return new DonationSettingsEntity(settings);
  }

  async updateSettings(userId: string, data: UpdateDonationSettingsDto) {
    const { minAudioAmount, minTextAmount, ...otherSettings } = data;
    const update: UpdateDonationSettingsParams = {
      ...otherSettings,
      ...(minAudioAmount !== undefined
        ? { minAudioAmount: new Decimal(minAudioAmount) }
        : {}),
      ...(minTextAmount !== undefined
        ? { minTextAmount: new Decimal(minTextAmount) }
        : {}),
    };
    const settings = await this.donationSettingsRepository.update(
      userId,
      update,
    );

    return new DonationSettingsEntity(settings);
  }
}

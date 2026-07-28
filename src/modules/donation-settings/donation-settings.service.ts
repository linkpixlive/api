import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DonationSettingsRepository } from 'src/infra/db/repositories/donation-settings.repositories';
import { VoicesRepository } from 'src/infra/db/repositories/voices.repositories';
import { UpdateDonationSettingsDto } from './dto/update-donation-settings.dto';
import { DonationSettingsEntity } from './entities/donation-settings.entity';

@Injectable()
export class DonationSettingsService {
  constructor(
    private readonly donationSettingsRepository: DonationSettingsRepository,
    private readonly voicesRepository: VoicesRepository,
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
    if (data.defaultVoiceId) {
      const voice = await this.voicesRepository.findById(data.defaultVoiceId);
      if (!voice) {
        throw new BadRequestException('Voz padrão não encontrada');
      }
    }

    const settings = await this.donationSettingsRepository.update(userId, data);

    return new DonationSettingsEntity(settings);
  }
}

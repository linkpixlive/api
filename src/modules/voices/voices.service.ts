import { Injectable, NotFoundException } from '@nestjs/common';
import { getStorageUrl } from 'src/common/utils/storageUrl.util';
import { VoicesRepository } from 'src/infra/db/repositories/voices.repositories';
import { PublicVoiceEntity } from './entities/public-voice.entity';
import { VoiceEntity } from './entities/voice.entity';

@Injectable()
export class VoicesService {
  constructor(private readonly voicesRepository: VoicesRepository) {}

  async findActivePublic(): Promise<PublicVoiceEntity[]> {
    const voices = await this.voicesRepository.findActive();
    return voices.map(
      (v) =>
        new PublicVoiceEntity({
          id: v.id,
          name: v.name,
          photoUrl: getStorageUrl(v.photoUri),
          sampleUrl: getStorageUrl(v.sampleUrl),
        }),
    );
  }

  async findById(id: string) {
    const voice = await this.voicesRepository.findById(id);
    if (!voice) {
      throw new NotFoundException('Voz não encontrada');
    }
    return new VoiceEntity(voice);
  }
}

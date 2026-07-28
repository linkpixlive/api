import { Injectable, NotFoundException } from '@nestjs/common';
import { VoicesRepository } from 'src/infra/db/repositories/voices.repositories';
import { CreateVoiceDto } from './dto/create-voice.dto';
import { UpdateVoiceDto } from './dto/update-voice.dto';
import { VoiceEntity } from './entities/voice.entity';

@Injectable()
export class VoicesService {
  constructor(private readonly voicesRepository: VoicesRepository) {}

  async findAll() {
    const voices = await this.voicesRepository.findAll();
    return voices.map((v) => new VoiceEntity(v));
  }

  async findActive() {
    const voices = await this.voicesRepository.findActive();
    return voices.map((v) => new VoiceEntity(v));
  }

  async findById(id: string) {
    const voice = await this.voicesRepository.findById(id);
    if (!voice) {
      throw new NotFoundException('Voz não encontrada');
    }
    return new VoiceEntity(voice);
  }

  async create(dto: CreateVoiceDto) {
    const voice = await this.voicesRepository.create(dto);
    return new VoiceEntity(voice);
  }

  async update(id: string, dto: UpdateVoiceDto) {
    const existing = await this.voicesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Voz não encontrada');
    }
    const voice = await this.voicesRepository.update(id, dto);
    return new VoiceEntity(voice);
  }

  async remove(id: string) {
    const existing = await this.voicesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Voz não encontrada');
    }
    await this.voicesRepository.remove(id);
  }
}

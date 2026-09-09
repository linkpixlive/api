import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Voice } from '@prisma/client';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { UploadedFile } from 'src/common/interfaces/uploaded-file.interface';
import { getStorageUrl } from 'src/common/utils/storageUrl.util';
import { VoicesRepository } from 'src/infra/db/repositories/voices.repositories';
import { StorageContract } from 'src/infra/storage/contract/storage.contract';
import { CreateVoiceDto } from 'src/modules/voices/dto/create-voice.dto';
import { UpdateVoiceDto } from 'src/modules/voices/dto/update-voice.dto';
import { VoiceEntity } from 'src/modules/voices/entities/voice.entity';

export const MAX_VOICE_PHOTO_SIZE_BYTES = 2 * 1024 * 1024;
export const MAX_VOICE_AUDIO_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_VOICE_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const VOICE_PHOTO_MAX_DIMENSION = 512;
const VOICE_PHOTO_WEBP_QUALITY = 80;

const AUDIO_EXTENSION_BY_MIMETYPE: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
};

export interface VoiceFiles {
  photo?: UploadedFile[];
  audio?: UploadedFile[];
}

@Injectable()
export class AdminVoicesService {
  constructor(
    private voicesRepository: VoicesRepository,
    private storage: StorageContract,
  ) {}

  async findAll() {
    const voices = await this.voicesRepository.findAll();
    return voices.map((v) => this.toEntity(v));
  }

  async findById(id: string) {
    const voice = await this.findExistingVoice(id);
    return this.toEntity(voice);
  }

  async create(dto: CreateVoiceDto, files?: VoiceFiles) {
    const { photoUri, sampleUrl } = await this.uploadFiles(files);

    const voice = await this.voicesRepository.create({
      name: dto.name,
      provider: dto.provider,
      voiceId: dto.voiceId,
      isActive: dto.isActive,
      photoUri,
      sampleUrl,
    });

    return this.toEntity(voice);
  }

  async update(id: string, dto: UpdateVoiceDto, files?: VoiceFiles) {
    const existing = await this.findExistingVoice(id);

    const { photoUri, sampleUrl } = await this.uploadFiles(files);

    const voice = await this.voicesRepository.update(id, {
      name: dto.name,
      provider: dto.provider,
      voiceId: dto.voiceId,
      isActive: dto.isActive,
      photoUri,
      sampleUrl,
    });

    if (photoUri && existing.photoUri) {
      await this.storage.deleteObject(existing.photoUri);
    }
    if (sampleUrl && existing.sampleUrl) {
      await this.storage.deleteObject(existing.sampleUrl);
    }

    return this.toEntity(voice);
  }

  async remove(id: string) {
    const existing = await this.findExistingVoice(id);
    await this.voicesRepository.remove(id);

    if (existing.photoUri) {
      await this.storage.deleteObject(existing.photoUri);
    }
    if (existing.sampleUrl) {
      await this.storage.deleteObject(existing.sampleUrl);
    }
  }

  private async uploadFiles(files?: VoiceFiles) {
    let photoUri: string | undefined;
    let sampleUrl: string | undefined;

    if (files?.photo?.length) {
      photoUri = await this.uploadVoicePhoto(files.photo[0]);
    }

    if (files?.audio?.length) {
      sampleUrl = await this.uploadVoiceAudio(files.audio[0]);
    }

    return { photoUri, sampleUrl };
  }

  private async uploadVoicePhoto(file: UploadedFile): Promise<string> {
    this.validatePhotoFile(file);

    const buffer = await this.convertToWebP(file.buffer);
    const key = `voices/photos/${randomUUID()}.webp`;

    await this.storage.upload(buffer, key, 'image/webp');
    return key;
  }

  private async uploadVoiceAudio(file: UploadedFile): Promise<string> {
    this.validateAudioFile(file);

    const key = `voices/audio/${randomUUID()}.${
      AUDIO_EXTENSION_BY_MIMETYPE[file.mimetype]
    }`;

    await this.storage.upload(file.buffer, key, file.mimetype);
    return key;
  }

  private validatePhotoFile(file: UploadedFile): void {
    if (!ALLOWED_VOICE_PHOTO_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Formato de imagem inválido. Formatos aceitos: JPEG, PNG e WebP.',
      );
    }

    if (file.buffer.length > MAX_VOICE_PHOTO_SIZE_BYTES) {
      throw new BadRequestException('Imagem excede o tamanho máximo de 2 MB.');
    }
  }

  private validateAudioFile(file: UploadedFile): void {
    if (!AUDIO_EXTENSION_BY_MIMETYPE[file.mimetype]) {
      throw new BadRequestException(
        'Formato de áudio inválido. Formatos aceitos: MP3, WAV, OGG e M4A.',
      );
    }

    if (file.buffer.length > MAX_VOICE_AUDIO_SIZE_BYTES) {
      throw new BadRequestException('Áudio excede o tamanho máximo de 5 MB.');
    }
  }

  private async convertToWebP(buffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(buffer)
        .rotate()
        .resize(VOICE_PHOTO_MAX_DIMENSION, VOICE_PHOTO_MAX_DIMENSION, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: VOICE_PHOTO_WEBP_QUALITY })
        .toBuffer();
    } catch {
      throw new BadRequestException('Arquivo não é uma imagem válida.');
    }
  }

  private async findExistingVoice(id: string) {
    const voice = await this.voicesRepository.findById(id);
    if (!voice) {
      throw new NotFoundException('Voz não encontrada');
    }
    return voice;
  }

  private toEntity(voice: Voice) {
    const entity = new VoiceEntity(voice);
    entity.photoUri = getStorageUrl(voice.photoUri);
    entity.sampleUrl = getStorageUrl(voice.sampleUrl);
    return entity;
  }
}

import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { SpeechContract } from '../contract/speech.contract';
import { GoogleTTSResponse } from './google.type';

@Injectable()
export class GoogleService extends SpeechContract {
  private readonly logger = new Logger(GoogleService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    super();
  }

  async generateTTS({
    message,
    voice = 'pt-BR-Wavenet-A',
  }: {
    message: string;
    voice?: string;
  }): Promise<Buffer> {
    const response = this.httpService.post<GoogleTTSResponse>(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.configService.get('GEMINI_KEY')}`,
      {
        input: { text: message },
        voice: {
          languageCode: 'pt-BR',
          name: voice,
        },
        audioConfig: {
          audioEncoding: 'MP3',
        },
      },
    );

    const { data } = await firstValueFrom(response).catch((error: unknown) => {
      const axiosResponse = (error as { response?: { status?: unknown } })
        ?.response;
      const status = axiosResponse?.status;
      const statusText =
        typeof status === 'number' || typeof status === 'string'
          ? String(status)
          : '?';
      this.logger.warn(`Google TTS falhou (status ${statusText})`);
      throw error;
    });

    if (!data.audioContent) throw new BadRequestException('Error Google TTS');

    return Buffer.from(data.audioContent, 'base64');
  }
}

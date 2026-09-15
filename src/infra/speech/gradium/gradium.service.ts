import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { SpeechContract } from '../contract/speech.contract';

const ERROR_BODY_LIMIT = 500;

@Injectable()
export class GradiumService extends SpeechContract {
  private readonly logger = new Logger(GradiumService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    super();
  }

  async generateTTS({
    message,
    voice,
  }: {
    message: string;
    voice: string | null;
  }): Promise<Buffer> {
    const response = this.httpService.post<ArrayBuffer>(
      'https://api.gradium.ai/api/post/speech/tts',
      {
        text: message,
        voice_id: voice ?? 'YHOBjtajNBEHUI_K',
        output_format: 'wav',
        only_audio: true,
      },
      {
        headers: {
          'x-api-key': this.configService.get<string>('GRADIUM_API_KEY'),
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      },
    );

    const axiosResponse = await firstValueFrom(response).catch(
      (error: unknown) => {
        const axiosResponse = (
          error as { response?: { status?: unknown; data?: unknown } }
        )?.response;
        const status = axiosResponse?.status;
        const statusText =
          typeof status === 'number' || typeof status === 'string'
            ? String(status)
            : '?';
        this.logger.error(
          `Gradium TTS falhou (status ${statusText}): ${decodeGradiumError(axiosResponse?.data)}`,
        );
        throw error;
      },
    );
    const audioBuffer = Buffer.from(axiosResponse.data);

    if (!audioBuffer.length) throw new BadRequestException('Error Gradium TTS');

    return audioBuffer;
  }
}

function decodeGradiumError(data: unknown): string {
  try {
    if (!data) return 'sem corpo de resposta';
    const text =
      typeof data === 'string'
        ? data
        : Buffer.from(data as ArrayBuffer).toString('utf-8');
    return text.slice(0, ERROR_BODY_LIMIT) || 'corpo vazio';
  } catch {
    return 'corpo ilegível';
  }
}

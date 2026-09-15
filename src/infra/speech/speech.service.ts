import { Injectable } from '@nestjs/common';
import { SpeechContract } from './contract/speech.contract';
import { GoogleService } from './google/google.service';
import { GradiumService } from './gradium/gradium.service';

@Injectable()
export class SpeechService extends SpeechContract {
  constructor(
    private readonly google: GoogleService,
    private readonly gradium: GradiumService,
  ) {
    super();
  }

  async generateTTS({
    message,
    voice,
    provider,
  }: {
    message: string;
    voice?: string | null;
    provider?: string | null;
  }): Promise<Buffer> {
    if ((provider ?? '').toLowerCase() === 'google') {
      return this.google.generateTTS({
        message,
        voice: voice ?? undefined,
      });
    }

    return this.gradium.generateTTS({ message, voice: voice ?? null });
  }
}

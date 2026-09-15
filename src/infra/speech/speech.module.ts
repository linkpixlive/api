import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SpeechContract } from './contract/speech.contract';
import { GoogleService } from './google/google.service';
import { GradiumService } from './gradium/gradium.service';
import { SpeechService } from './speech.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [
    GoogleService,
    GradiumService,
    SpeechService,
    {
      provide: SpeechContract,
      useExisting: SpeechService,
    },
  ],
  exports: [GoogleService, GradiumService, SpeechService, SpeechContract],
})
export class SpeechModule {}

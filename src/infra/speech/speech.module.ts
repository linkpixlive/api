import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SpeechContract } from './contract/speech.contract';
import { GoogleService } from './google/google.service';
import { GradiumService } from './gradium/gradium.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [
    GoogleService,
    GradiumService,
    {
      provide: SpeechContract,
      useExisting: GradiumService,
    },
  ],
  exports: [GoogleService, GradiumService, SpeechContract],
})
export class SpeechModule {}

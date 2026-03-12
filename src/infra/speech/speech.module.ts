import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SpeechContract } from './contract/speech.contract';
import { GoogleService } from './google/google.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [
    {
      provide: SpeechContract,
      useClass: GoogleService,
    },
  ],
  exports: [SpeechContract],
})
export class SpeechModule {}

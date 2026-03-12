import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiContract } from './contract/ai.contract';
import { GeminiService } from './gemini/gemini.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: AiContract,
      useClass: GeminiService,
    },
  ],
  exports: [AiContract],
})
export class AiModule {}

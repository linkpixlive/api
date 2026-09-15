import { GoogleGenAI, Type } from '@google/genai';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiContract,
  AiModerationInput,
  ModerationVerdict,
} from '../contract/ai.contract';
import {
  MODERATION_CATEGORIES,
  MODERATION_SYSTEM_INSTRUCTION,
  MODERATION_TIMEOUT_MS,
  buildModerationPrompt,
  parseModerationVerdict,
} from '../moderation/moderation-policy';

@Injectable()
export class GeminiService implements AiContract {
  private readonly logger = new Logger(GeminiService.name);
  private gemini: GoogleGenAI;

  constructor(private readonly configService: ConfigService) {
    this.gemini = new GoogleGenAI({
      apiKey: this.configService.get('GEMINI_KEY'),
    });
  }

  async moderate(input: AiModerationInput): Promise<ModerationVerdict> {
    const name = input.name?.trim() ?? '';
    const message = input.message?.trim() ?? '';

    if (!name && !message) {
      return { blocked: false, categories: [] };
    }

    try {
      const response = await this.gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [{ text: buildModerationPrompt(input) }],
          },
        ],
        config: {
          systemInstruction: MODERATION_SYSTEM_INSTRUCTION,
          temperature: 0,
          abortSignal: AbortSignal.timeout(MODERATION_TIMEOUT_MS),
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              blocked: { type: Type.BOOLEAN },
              categories: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING,
                  enum: [...MODERATION_CATEGORIES],
                },
              },
            },
            required: ['blocked', 'categories'],
          },
        },
      });

      return parseModerationVerdict(
        response.candidates?.[0]?.content?.parts?.[0]?.text,
      );
    } catch (error) {
      this.logger.warn(
        `Moderação IA indisponível (fail-open): ${error instanceof Error ? error.message : String(error)}`,
      );
      return { blocked: false, categories: [] };
    }
  }
}

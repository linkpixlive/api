import { GoogleGenAI } from '@google/genai';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiContract, AiModOptions } from '../contract/ai.contract';

@Injectable()
export class GeminiService implements AiContract {
  private gemini: GoogleGenAI;

  constructor(private readonly configService: ConfigService) {
    this.gemini = new GoogleGenAI({
      apiKey: this.configService.get('GEMINI_KEY'),
    });
  }

  async cleanMessage(
    userMessage: string,
    options?: AiModOptions,
  ): Promise<string> {
    try {
      const filterProfanity = options?.filterProfanity ?? true;
      const filterSpam = options?.filterSpam ?? true;
      const blockedWords = options?.blockedWords || [];

      let instruction = `Você é um assistente de moderação para streamers. 
Sua missão é processar mensagens de doações, tornando-as seguras para leitura em voz alta (TTS), mas mantendo a zoeira e o espírito da comunidade.

DIRETRIZES DE TRATAMENTO:`;

      if (filterProfanity) {
        instruction += `
1. IDENTIFICAÇÃO DE VARIANTES: Detecte palavrões mesmo que usem números ou letras repetidas (ex: "buucet4", "fdp", "cuz4o", "p0rr4"). 
2. SUBSTITUIÇÃO CRIATIVA: Não apague a frase. Troque a palavra ofensiva por termos engraçados, leves ou "nerds" que mantenham o sentido da piada. 
  - Ex: "VAI TOMAR NO CU" -> "VAI TOMAR UM SUCO"
  - Ex: "ESSA BUUCET4" -> "ESSA BENZINA" ou "ESSA REBIMBOCA"`;
      }

      if (filterSpam) {
        instruction += `
3. REMOÇÃO DE SPAM: Se identificar repetições sem sentido (ex: "lolololo", "aaaaa", "testando 123 123"), remova o excesso e deixe apenas uma ocorrência ou limpe o lixo.`;
      }

      if (blockedWords.length > 0) {
        instruction += `
4. PALAVRAS PROIBIDAS ESPECÍFICAS (Obrigatório bloquear/substituir): ${blockedWords.join(', ')}.`;
      }

      instruction += `
5. MANTENHA O HUMOR: O objetivo é que o streamer e o chat riam da substituição, não que a mensagem perca a graça.
6. REGRA DE OURO: Retorne APENAS o texto final tratado. Não explique o que mudou, não peça desculpas e não adicione comentários.`;

      const response = await this.gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        config: {
          systemInstruction: instruction,
          temperature: 0.2,
        },
      });

      // console.log(JSON.stringify(response, null, 2));

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
      return text ? text.trim() : userMessage;
    } catch (error) {
      console.error('GenAI Error:', error);
      return 'Message could not be processed.';
    }
  }
}

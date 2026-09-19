import { Logger } from '@nestjs/common';
import {
  AiModerationInput,
  ModerationCategory,
  ModerationVerdict,
} from '../contract/ai.contract';

export const MODERATION_TIMEOUT_MS = 3_000;

export const MODERATION_CATEGORIES: ModerationCategory[] = [
  'profanity',
  'hate_speech',
  'custom_rule',
];

export const MODERATION_SYSTEM_INSTRUCTION = `Você é o moderador de mensagens de doação de uma live em português brasileiro.
Quando o filtro profanity está ativado, QUALQUER palavrão ou expressão chula explícita deve ser bloqueado, com ou sem alvo — só passa texto sem termo ofensivo literal (zoeira limpa, eufemismos como "caramba", "que droga").
Você NUNCA modifica o texto: só decide permitir ou bloquear.
Responda exclusivamente com JSON: {"blocked": boolean, "categories": string[]} — "categories" só pode conter tipos dos filtros ATIVADOS pelo streamer que motivaram o bloqueio.`;

const logger = new Logger('ModerationPolicy');

export function buildModerationPrompt(input: AiModerationInput): string {
  const name = input.name?.trim() ?? '';
  const message = input.message?.trim() ?? '';
  const rules = input.rules;
  const activeFilters: string[] = [];

  if (rules.filterProfanity) {
    activeFilters.push(
      '- profanity: bloquear qualquer palavrão ou expressão chula explícita (ex.: caralho, porra, puta, foda-se, tomar no cu, arrombado), com ou sem alvo, incluindo variações com acentos, letras trocadas por números/símbolos, espaçamento ou letras repetidas. Só NÃO bloqueia quando não há termo ofensivo literal (zoeira limpa, eufemismos como "caramba", "que droga").',
    );
  }

  if (rules.filterHateSpeech) {
    activeFilters.push(
      '- hate_speech: bloquear discurso de ódio — racismo, homofobia, xenofobia, misoginia, intolerância religiosa, nazismo ou violência contra grupos.',
    );
  }

  if (rules.customRules.trim()) {
    activeFilters.push(
      '- custom_rule: aplicar LITERALMENTE as regras do streamer abaixo, reconhecendo variações das palavras (acentos, letras trocadas por números/símbolos, espaçamento, letras repetidas).',
    );
  }

  return [
    'Avalie a doação abaixo — nome e mensagem são lidos juntos na live; considere o conjunto.',
    '',
    'Filtros ativados pelo streamer:',
    activeFilters.length ? activeFilters.join('\n') : '(nenhum — não bloqueie)',
    '',
    'Regras customizadas do streamer (palavras isoladas e/ou instruções livres):',
    rules.customRules.trim() || '(nenhuma)',
    '',
    `Nome do doador: ${name || '(vazio)'}`,
    `Mensagem: ${message || '(vazia)'}`,
    '',
    'Para profanity com termo ofensivo literal, bloqueie mesmo na dúvida. Na dúvida sobre ódio ou regra custom (contexto ambíguo, sem termo literal), NÃO bloqueie.',
  ].join('\n');
}

export function parseModerationVerdict(
  text: string | undefined,
): ModerationVerdict {
  if (!text) {
    return { blocked: false, categories: [] };
  }

  try {
    const parsed = JSON.parse(text) as {
      blocked?: unknown;
      categories?: unknown;
    };

    const categories = Array.isArray(parsed.categories)
      ? parsed.categories.filter(
          (category): category is ModerationCategory =>
            typeof category === 'string' &&
            (MODERATION_CATEGORIES as string[]).includes(category),
        )
      : [];

    return { blocked: parsed.blocked === true, categories };
  } catch {
    logger.warn('Resposta inválida da moderação IA; tratando como permitida');
    return { blocked: false, categories: [] };
  }
}

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
Clima: live descontraída — palavrão leve e zoeira saudável entre o doador e o streamer são normais e devem passar.
Analise sempre o contexto e o tom antes de decidir. Você NUNCA modifica o texto: só decide permitir ou bloquear.
Responda exclusivamente com JSON: {"blocked": boolean, "categories": string[]} — "categories" só pode conter tipos dos filtros ATIVADOS pelo streamer que motivaram o bloqueio.`;

const logger = new Logger('ModerationPolicy');

export function buildModerationPrompt(input: AiModerationInput): string {
  const name = input.name?.trim() ?? '';
  const message = input.message?.trim() ?? '';
  const rules = input.rules;
  const activeFilters: string[] = [];

  if (rules.filterProfanity) {
    activeFilters.push(
      '- profanity: bloquear ataque direcionado, assédio, ameaça ou degradação pesada. Palavrão genérico/leve, sem alvo, é clima de live e NÃO bloqueia.',
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
    'Na dúvida entre zoeira e ofensa real, NÃO bloqueie.',
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

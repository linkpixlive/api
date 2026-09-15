export type ModerationCategory = 'profanity' | 'hate_speech' | 'custom_rule';

export interface AiModerationRules {
  filterProfanity: boolean;
  filterHateSpeech: boolean;
  customRules: string;
}

export interface AiModerationInput {
  name: string;
  message: string;
  rules: AiModerationRules;
}

export interface ModerationVerdict {
  blocked: boolean;
  categories: ModerationCategory[];
}

export abstract class AiContract {
  abstract moderate(input: AiModerationInput): Promise<ModerationVerdict>;
}

export interface AiModOptions {
  filterProfanity?: boolean;
  filterSpam?: boolean;
  blockedWords?: string[];
}

export abstract class AiContract {
  abstract cleanMessage(
    message: string,
    options?: AiModOptions,
  ): Promise<string>;
}

export abstract class AiContract {
  abstract cleanMessage(message: string): Promise<string>;
}

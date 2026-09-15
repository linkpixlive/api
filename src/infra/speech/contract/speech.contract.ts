export abstract class SpeechContract {
  abstract generateTTS({
    message,
    voice,
    provider,
  }: {
    message: string;
    voice?: string | null;
    provider?: string | null;
  }): Promise<Buffer>;
}

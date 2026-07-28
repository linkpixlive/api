export abstract class SpeechContract {
  abstract generateTTS({
    message,
    voice,
  }: {
    message: string;
    voice?: string | null;
  }): Promise<Buffer>;
}

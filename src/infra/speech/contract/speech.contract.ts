export abstract class SpeechContract {
  abstract generateTTS({
    message,
    voice,
  }: {
    message: string;
    voice?: string;
  }): Promise<string>;
}

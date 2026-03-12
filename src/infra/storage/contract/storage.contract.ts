export abstract class StorageContract {
  abstract uploadAudio(file: Buffer, key: string): Promise<void>;
}

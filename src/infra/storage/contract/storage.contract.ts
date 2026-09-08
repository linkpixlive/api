export abstract class StorageContract {
  abstract upload(
    file: Buffer,
    key: string,
    contentType: string,
  ): Promise<void>;

  abstract deleteObject(key: string): Promise<void>;
}

import type { Readable } from 'node:stream';

export interface StoredObject {
  body: Readable;
  contentType?: string;
  contentLength?: number;
}

export abstract class StorageContract {
  abstract upload(
    file: Buffer,
    key: string,
    contentType: string,
  ): Promise<void>;

  abstract getObject(key: string): Promise<StoredObject>;

  abstract exists(key: string): Promise<boolean>;

  abstract deleteObject(key: string): Promise<void>;
}

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Readable } from 'node:stream';
import {
  StorageContract,
  type StoredObject,
} from '../contract/storage.contract';

@Injectable()
export class R2Service extends StorageContract {
  private r2Client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    super();
    this.r2Client = new S3Client({
      region: 'auto',
      endpoint: this.configService.get<string>('R2_ENDPOINT_URL'),
      credentials: {
        accessKeyId: this.configService.get<string>('R2_ACCESS_KEY')!,
        secretAccessKey: this.configService.get<string>('R2_SECRET_KEY')!,
      },
    });
    this.bucket = this.configService.get<string>('R2_BUCKET_NAME')!;
  }

  async upload(file: Buffer, key: string, contentType: string) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file,
      ContentType: contentType,
    });

    await this.r2Client.send(command);
  }

  async getObject(key: string): Promise<StoredObject> {
    const res = await this.r2Client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    return {
      body: res.Body as Readable,
      contentType: res.ContentType,
      contentLength: res.ContentLength,
    };
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.r2Client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch (error) {
      if (isNotFoundError(error)) return false;
      throw error;
    }
  }

  async deleteObject(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.r2Client.send(command);
  }
}

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const err = error as {
    name?: unknown;
    $metadata?: { httpStatusCode?: unknown };
  };
  return (
    err.name === 'NotFound' ||
    err.name === 'NoSuchKey' ||
    err.$metadata?.httpStatusCode === 404
  );
}

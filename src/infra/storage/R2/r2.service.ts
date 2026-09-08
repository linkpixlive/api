import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageContract } from '../contract/storage.contract';

@Injectable()
export class R2Service extends StorageContract {
  private r2Client: S3Client;

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
  }

  async upload(file: Buffer, key: string, contentType: string) {
    const command = new PutObjectCommand({
      Bucket: 'tipply',
      Key: key,
      Body: file,
      ContentType: contentType,
    });

    await this.r2Client.send(command);
  }

  async deleteObject(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: 'tipply',
      Key: key,
    });

    await this.r2Client.send(command);
  }
}

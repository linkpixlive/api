import { Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

@Injectable()
export class SecurityService {
  private IV_LENGTH = 12;
  private TAG_LENGTH = 16;
  private KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

  encryptData(text: string): string {
    const iv = randomBytes(this.IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.KEY, iv);

    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  decryptData(cipherText: string): string {
    const data = Buffer.from(cipherText, 'base64');

    const iv = data.subarray(0, this.IV_LENGTH);
    const tag = data.subarray(this.IV_LENGTH, this.IV_LENGTH + this.TAG_LENGTH);
    const text = data.subarray(this.IV_LENGTH + this.TAG_LENGTH);

    const decipher = createDecipheriv('aes-256-gcm', this.KEY, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(text), decipher.final()]).toString(
      'utf8',
    );
  }

  hashData(value: string): string {
    return createHash('sha256')
      .update(value + process.env.ENCRYPTION_KEY)
      .digest('hex');
  }
}

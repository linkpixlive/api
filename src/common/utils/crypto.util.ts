import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  return Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
}

export function encryptData(text: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptData(cipherText: string): string {
  const data = Buffer.from(cipherText, 'base64');

  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const text = data.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(text), decipher.final()]).toString(
    'utf8',
  );
}

export function hashData(value: string): string {
  return createHash('sha256')
    .update(value + process.env.ENCRYPTION_KEY)
    .digest('hex');
}

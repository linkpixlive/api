import { BadRequestException } from '@nestjs/common';
import { validate } from './env.validation';

const baseConfig = (): Record<string, unknown> => ({
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  ENCRYPTION_KEY:
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  JWT_SECRET: 'a'.repeat(32),
  RESEND_API_KEY: 're_dummy',
  GEMINI_KEY: 'gemini_dummy',
  REDIS_URL: 'redis://localhost:6380',
  R2_ACCESS_KEY: 'r2-access',
  R2_SECRET_KEY: 'r2-secret',
  R2_ENDPOINT_URL: 'http://localhost:9000',
  R2_BUCKET_NAME: 'bucket',
  BUCKET_URL: 'http://localhost:9000/public',
  EFI_API_URL: 'https://api.example.com',
  EFI_CLIENT_ID: 'client-id',
  EFI_CLIENT_SECRET: 'client-secret',
  EFI_PIX_KEY: 'pix-key',
  EFI_CERTIFICATE_BASE64: Buffer.from('certificado').toString('base64'),
  EFI_WEBHOOK_SECRET: 'webhook-secret',
  WITHDRAWAL_FEE_PERCENTAGE: 5,
  MIN_WITHDRAWAL_AMOUNT: 10,
  MAX_PIX_KEYS_PER_USER: 5,
  PIX_EXPIRATION_SECONDS: 300,
  JWT_EXPIRES_IN_DAYS: '7',
  EMAIL_FROM_ADDRESS: 'no-reply@example.com',
  GRADIUM_API_KEY: 'gradium-key',
});

describe('validate (env)', () => {
  it('aceita configuração completa e válida', () => {
    const result = validate(baseConfig());

    expect(result.WITHDRAWAL_FEE_PERCENTAGE).toBe(5);
    expect(result.NODE_ENV).toBe('development');
  });

  it('coerção numérica: strings viram números', () => {
    const config = {
      ...baseConfig(),
      WITHDRAWAL_FEE_PERCENTAGE: '5',
      PIX_EXPIRATION_SECONDS: '300',
    };

    expect(validate(config).WITHDRAWAL_FEE_PERCENTAGE).toBe(5);
    expect(validate(config).PIX_EXPIRATION_SECONDS).toBe(300);
  });

  it('rejeita ENCRYPTION_KEY fora do formato 64-hex', () => {
    expect(() =>
      validate({ ...baseConfig(), ENCRYPTION_KEY: 'chave-curta' }),
    ).toThrow(BadRequestException);
  });

  it('rejeita JWT_SECRET com menos de 32 caracteres', () => {
    expect(() => validate({ ...baseConfig(), JWT_SECRET: 'curto' })).toThrow(
      BadRequestException,
    );
  });

  it('rejeita WITHDRAWAL_FEE_PERCENTAGE fora de 0-100', () => {
    expect(() =>
      validate({ ...baseConfig(), WITHDRAWAL_FEE_PERCENTAGE: 150 }),
    ).toThrow(BadRequestException);
    expect(() =>
      validate({ ...baseConfig(), WITHDRAWAL_FEE_PERCENTAGE: -1 }),
    ).toThrow(BadRequestException);
  });

  it('rejeita MIN_WITHDRAWAL_AMOUNT menor que 1', () => {
    expect(() =>
      validate({ ...baseConfig(), MIN_WITHDRAWAL_AMOUNT: 0 }),
    ).toThrow(BadRequestException);
  });

  it('rejeita PIX_EXPIRATION_SECONDS menor que 60', () => {
    expect(() =>
      validate({ ...baseConfig(), PIX_EXPIRATION_SECONDS: 30 }),
    ).toThrow(BadRequestException);
  });

  it('rejeita NODE_ENV fora do enum', () => {
    expect(() => validate({ ...baseConfig(), NODE_ENV: 'staging' })).toThrow(
      BadRequestException,
    );
  });

  it('rejeita EFI_CERTIFICATE_BASE64 não-base64', () => {
    expect(() =>
      validate({ ...baseConfig(), EFI_CERTIFICATE_BASE64: '!!!não-base64' }),
    ).toThrow(BadRequestException);
  });

  it('aceita DEFAULT_VOICE_ID como UUID válido (campo opcional)', () => {
    const result = validate({
      ...baseConfig(),
      DEFAULT_VOICE_ID: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    });

    expect(result.DEFAULT_VOICE_ID).toBe(
      'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    );
  });

  it('rejeita DEFAULT_VOICE_ID que não é UUID', () => {
    expect(() =>
      validate({ ...baseConfig(), DEFAULT_VOICE_ID: 'not-a-uuid' }),
    ).toThrow(BadRequestException);
  });

  it('rejeita variável obrigatória ausente', () => {
    const incomplete = baseConfig();
    delete incomplete.DATABASE_URL;

    expect(() => validate(incomplete)).toThrow(BadRequestException);
  });
});

import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import {
  IsBase64,
  IsEnum,
  IsHexadecimal,
  IsNotEmpty,
  IsString,
  IsUrl,
  Length,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsHexadecimal()
  @Length(64, 64, {
    message:
      'ENCRYPTION_KEY must be exactly 64 hexadecimal characters (256-bit)',
  })
  @IsNotEmpty()
  ENCRYPTION_KEY: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  RESEND_API_KEY: string;

  @IsString()
  @IsNotEmpty()
  GEMINI_KEY: string;

  // REDIS
  @IsString()
  @IsNotEmpty()
  REDIS_URL: string;

  // STORAGE
  @IsString()
  @IsNotEmpty()
  R2_ACCESS_KEY: string;

  @IsString()
  @IsNotEmpty()
  R2_SECRET_KEY: string;

  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  @IsNotEmpty()
  R2_ENDPOINT_URL: string;

  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  @IsNotEmpty()
  BUCKET_URL: string;

  // GATEWAY
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  @IsNotEmpty()
  EFI_API_URL: string;

  @IsString()
  @IsNotEmpty()
  EFI_CLIENT_ID: string;

  @IsString()
  @IsNotEmpty()
  EFI_CLIENT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  EFI_PIX_KEY: string;

  @IsString()
  @IsNotEmpty()
  @IsBase64()
  EFI_CERTIFICATE_BASE64: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new BadRequestException(
      `Environment validation failed:\n${errors
        .map((e) => Object.values(e.constraints || {}).join(', '))
        .join('\n')}`,
    );
  }

  return validatedConfig;
}

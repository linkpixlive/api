import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class UpdateVoiceDto {
  @ApiPropertyOptional({ example: 'Google Feminina PT-BR', maxLength: 100 })
  @IsOptional()
  @IsString({ message: 'O nome deve ser uma string' })
  @MaxLength(100, { message: 'O nome deve ter no máximo 100 caracteres' })
  name?: string;

  @ApiPropertyOptional({ example: 'google', maxLength: 50 })
  @IsOptional()
  @IsString({ message: 'O provider deve ser uma string' })
  @MaxLength(50, { message: 'O provider deve ter no máximo 50 caracteres' })
  provider?: string;

  @ApiPropertyOptional({ example: 'pt-BR-Standard-A', maxLength: 100 })
  @IsOptional()
  @IsString({ message: 'O voiceId deve ser uma string' })
  @MaxLength(100, { message: 'O voiceId deve ter no máximo 100 caracteres' })
  voiceId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean({ message: 'isActive deve ser um valor booleano' })
  isActive?: boolean;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Arquivo de imagem da voz (JPEG, PNG ou WebP, máx. 2 MB)',
  })
  @IsOptional()
  photo?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Áudio de exemplo reproduzido no formulário de doação',
  })
  @IsOptional()
  audio?: string;
}

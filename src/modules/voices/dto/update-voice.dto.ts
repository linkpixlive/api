import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

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
  @IsBoolean({ message: 'isActive deve ser um valor booleano' })
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/voices/foto.png',
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: 'A foto deve ser uma string' })
  @MaxLength(500, { message: 'A foto deve ter no máximo 500 caracteres' })
  photoUri?: string;
}

import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVoiceDto {
  @ApiProperty({ example: 'Google Feminina PT-BR', maxLength: 100 })
  @IsString({ message: 'O nome deve ser uma string' })
  @IsNotEmpty({ message: 'O nome não pode estar vazio' })
  @MaxLength(100, { message: 'O nome deve ter no máximo 100 caracteres' })
  name: string;

  @ApiProperty({ example: 'google', maxLength: 50 })
  @IsString({ message: 'O provider deve ser uma string' })
  @IsNotEmpty({ message: 'O provider não pode estar vazio' })
  @MaxLength(50, { message: 'O provider deve ter no máximo 50 caracteres' })
  provider: string;

  @ApiProperty({ example: 'pt-BR-Standard-A', maxLength: 100 })
  @IsString({ message: 'O voiceId deve ser uma string' })
  @IsNotEmpty({ message: 'O voiceId não pode estar vazio' })
  @MaxLength(100, { message: 'O voiceId deve ter no máximo 100 caracteres' })
  voiceId: string;

  @ApiPropertyOptional({ example: true, default: true })
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

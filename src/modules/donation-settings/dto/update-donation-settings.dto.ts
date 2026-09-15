import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateDonationSettingsDto {
  @ApiPropertyOptional({ example: 250 })
  @IsOptional()
  @IsNumber({}, { message: 'O tamanho máximo deve ser um número' })
  @Min(0, { message: 'O tamanho máximo não pode ser negativo' })
  maxLength?: number;

  @ApiPropertyOptional({ example: 5.0 })
  @IsOptional()
  @IsNumber({}, { message: 'O valor mínimo de áudio deve ser um número' })
  @Min(1, { message: 'O valor mínimo de áudio é 1' })
  minAudioAmount?: number;

  @ApiPropertyOptional({ example: 1.0 })
  @IsOptional()
  @IsNumber({}, { message: 'O valor mínimo de texto deve ser um número' })
  @Min(1, { message: 'O valor mínimo de texto é 1' })
  minTextAmount?: number;

  @ApiPropertyOptional({
    example: false,
    description:
      'Toggle mestre da moderação IA — off desativa todos os filtros',
  })
  @IsOptional()
  @IsBoolean({ message: 'Moderação de IA deve ser um valor booleano' })
  aiModeration?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: 'Filtrar profanidade deve ser um valor booleano' })
  filterProfanity?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: 'Filtrar spam deve ser um valor booleano' })
  filterSpam?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean({ message: 'Filtrar discurso de ódio deve ser um valor booleano' })
  filterHateSpeech?: boolean;

  @ApiPropertyOptional({
    example: 'casino\nSem divulgação de outros canais',
    description:
      'Regras customizadas em texto único: palavras (uma por linha) e/ou instruções livres de contexto',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString({ message: 'As regras customizadas devem ser um texto' })
  @MaxLength(1000, {
    message: 'As regras customizadas devem ter no máximo 1000 caracteres',
  })
  customRules?: string;

  @ApiPropertyOptional({ example: 'uuid-voice-id' })
  @IsOptional()
  @IsUUID('4', { message: 'O ID da voz padrão deve ser um UUID válido' })
  defaultVoiceId?: string;
}

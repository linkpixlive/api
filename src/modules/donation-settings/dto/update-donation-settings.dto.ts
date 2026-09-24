import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  MAX_DONATION_AMOUNT,
  MIN_DONATION_AMOUNT,
} from 'src/common/constants/donation.constants';
import { IsMoney } from 'src/common/decorators/is-money.decorator';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateDonationSettingsDto {
  @ApiPropertyOptional({ example: 250, minimum: 0, maximum: 250 })
  @IsOptional()
  @IsNumber({}, { message: 'O tamanho máximo deve ser um número' })
  @IsInt({ message: 'O tamanho máximo deve ser um número inteiro' })
  @Min(0, { message: 'O tamanho máximo não pode ser negativo' })
  @Max(250, { message: 'O tamanho máximo não pode ser maior que 250' })
  maxLength?: number;

  @ApiPropertyOptional({
    example: 5.0,
    minimum: MIN_DONATION_AMOUNT,
    maximum: MAX_DONATION_AMOUNT,
  })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsNumber({}, { message: 'O valor mínimo de áudio deve ser um número' })
  @IsMoney({
    message: 'O valor mínimo de áudio deve ter no máximo 2 casas decimais',
  })
  @Min(MIN_DONATION_AMOUNT, { message: 'O valor mínimo de áudio é 1' })
  @Max(MAX_DONATION_AMOUNT, {
    message: `O valor mínimo de áudio deve ser no máximo ${MAX_DONATION_AMOUNT}`,
  })
  minAudioAmount?: number;

  @ApiPropertyOptional({
    example: 1.0,
    minimum: MIN_DONATION_AMOUNT,
    maximum: MAX_DONATION_AMOUNT,
  })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsNumber({}, { message: 'O valor mínimo de texto deve ser um número' })
  @IsMoney({
    message: 'O valor mínimo de texto deve ter no máximo 2 casas decimais',
  })
  @Min(MIN_DONATION_AMOUNT, { message: 'O valor mínimo de texto é 1' })
  @Max(MAX_DONATION_AMOUNT, {
    message: `O valor mínimo de texto deve ser no máximo ${MAX_DONATION_AMOUNT}`,
  })
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
}

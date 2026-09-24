import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MAX_DONATION_AMOUNT,
  MIN_DONATION_AMOUNT,
} from 'src/common/constants/donation.constants';
import { IsMoney } from 'src/common/decorators/is-money.decorator';
import { SanitizeHTML } from 'src/common/decorators/sanitize.decorator';

export class DonationDto {
  @ApiPropertyOptional({ example: 'John Doe', maxLength: 100 })
  @IsOptional()
  @IsString({ message: 'O nome deve ser uma string' })
  @MaxLength(100, { message: 'O nome deve ter no máximo 100 caracteres' })
  @SanitizeHTML()
  name?: string;

  @ApiProperty({ example: 'Keep up the good work!', maxLength: 250 })
  @IsString({ message: 'A mensagem deve ser uma string' })
  @MaxLength(250, { message: 'A mensagem deve ter no máximo 250 caracteres' })
  @SanitizeHTML()
  message: string;

  @ApiProperty({
    example: 10,
    minimum: MIN_DONATION_AMOUNT,
    maximum: MAX_DONATION_AMOUNT,
  })
  @IsNumber({}, { message: 'O valor deve ser um número' })
  @IsMoney({ message: 'O valor deve ter no máximo 2 casas decimais' })
  @Min(MIN_DONATION_AMOUNT, { message: 'O valor mínimo é 1' })
  @Max(MAX_DONATION_AMOUNT, {
    message: `O valor máximo é ${MAX_DONATION_AMOUNT}`,
  })
  amount: number;

  @ApiProperty({ example: 'uuid-voice-id', nullable: true, required: false })
  @IsOptional()
  @IsUUID('4', { message: 'O ID da voz deve ser um UUID válido' })
  voiceId?: string | null;

  @ApiProperty({ example: 'streamer_username' })
  @IsString({ message: 'O nome de usuário deve ser uma string' })
  @IsNotEmpty({ message: 'O nome de usuário não pode estar vazio' })
  username: string;
}

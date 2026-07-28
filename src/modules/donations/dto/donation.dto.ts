import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SanitizeHTML } from 'src/common/decorators/sanitize.decorator';

export class DonationDto {
  @ApiProperty({ example: 'John Doe', maxLength: 100 })
  @MaxLength(100, { message: 'O nome deve ter no máximo 100 caracteres' })
  @SanitizeHTML()
  name: string;

  @ApiProperty({ example: 'Keep up the good work!', maxLength: 250 })
  @IsString({ message: 'A mensagem deve ser uma string' })
  @MaxLength(250, { message: 'A mensagem deve ter no máximo 250 caracteres' })
  @SanitizeHTML()
  message: string;

  @ApiProperty({ example: 10, minimum: 1 })
  @IsNumber({}, { message: 'O valor deve ser um número' })
  @Min(1, { message: 'O valor mínimo é 1' })
  amount: number;

  @ApiProperty({ example: 'uuid-voice-id' })
  @IsUUID('4', { message: 'O ID da voz deve ser um UUID válido' })
  @IsNotEmpty({ message: 'O ID da voz não pode estar vazio' })
  voiceId: string;

  @ApiProperty({ example: 'streamer_username' })
  @IsString({ message: 'O nome de usuário deve ser uma string' })
  @IsNotEmpty({ message: 'O nome de usuário não pode estar vazio' })
  username: string;
}

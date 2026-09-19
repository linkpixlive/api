import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class OverlayWidgetSettingsDto {
  @ApiProperty({ example: 100 })
  @IsNumber({}, { message: 'volume deve ser um número' })
  @Min(0, { message: 'volume não pode ser menor que 0' })
  @Max(100, { message: 'volume não pode ser maior que 100' })
  volume: number;

  @ApiProperty({ example: true })
  @IsBoolean({ message: 'speakNameAmount deve ser um valor booleano' })
  speakNameAmount: boolean;

  @ApiProperty({
    example: 'uuid-voice-id',
    description:
      'ID da voz padrão (GET /voices) usada quando a doação vem sem voiceId ("Voz padrão do streamer")',
  })
  @IsString({ message: 'defaultNarrator deve ser uma string' })
  @IsNotEmpty({ message: 'defaultNarrator não pode estar vazio' })
  defaultNarrator: string;

  @ApiProperty({ example: false })
  @IsBoolean({ message: 'audioOnly deve ser um valor booleano' })
  audioOnly: boolean;
}

export interface PersistedOverlaySettings extends OverlayWidgetSettingsDto {
  isPaused: boolean;
}

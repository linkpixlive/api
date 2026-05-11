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
  @IsNumber()
  @Min(0)
  @Max(100)
  volume: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  speakNameAmount: boolean;

  @ApiProperty({ example: 'Ricardo' })
  @IsString()
  @IsNotEmpty()
  defaultNarrator: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  isPaused: boolean;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateDonationSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxLength?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  minAudioAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  minTextAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  filterProfanity?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  aiModeration?: boolean;
}

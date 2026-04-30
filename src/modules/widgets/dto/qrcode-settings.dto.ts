import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Max, Min } from 'class-validator';

export class QrCodeWidgetSettingsDto {
  @ApiProperty({ example: '#000000' })
  @IsString()
  color: string;

  @ApiProperty({ example: 256 })
  @IsNumber()
  @Min(128)
  @Max(1024)
  size: number;
}

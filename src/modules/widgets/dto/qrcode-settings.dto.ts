import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Max, Min } from 'class-validator';

export class QrCodeWidgetSettingsDto {
  @ApiProperty({ example: '#000000' })
  @IsString({ message: 'color deve ser uma string' })
  color: string;

  @ApiProperty({ example: 256 })
  @IsNumber({}, { message: 'size deve ser um número' })
  @Min(128, { message: 'size não pode ser menor que 128' })
  @Max(1024, { message: 'size não pode ser maior que 1024' })
  size: number;
}

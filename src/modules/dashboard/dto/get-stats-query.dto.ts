import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

const toUndefinedIfBlank = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export type DashboardRange = '7' | '15' | '30';

export class GetStatsQueryDto {
  @ApiProperty({ required: false, enum: ['7', '15', '30'], default: '7' })
  @Transform(toUndefinedIfBlank)
  @IsOptional()
  @IsIn(['7', '15', '30'], { message: 'range deve ser 7, 15 ou 30' })
  range?: DashboardRange = '7';
}

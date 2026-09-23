import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';

const toUndefinedIfBlank = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export class GetHistoryQueryDto extends PaginationQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({ required: false, enum: ['paid', 'displayed'] })
  @Transform(toUndefinedIfBlank)
  @IsOptional()
  @IsIn(['paid', 'displayed'], {
    message: 'status deve ser paid ou displayed',
  })
  status?: 'paid' | 'displayed';

  @ApiProperty({ required: false, enum: ['today', '7', '15', '30'] })
  @Transform(toUndefinedIfBlank)
  @IsOptional()
  @IsIn(['today', '7', '15', '30'], {
    message: 'days deve ser today, 7, 15 ou 30',
  })
  days?: 'today' | '7' | '15' | '30';

  @ApiProperty({ required: false, example: 'oi' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'search deve ter pelo menos 2 caracteres' })
  @MaxLength(100, { message: 'search deve ter no máximo 100 caracteres' })
  search?: string;

  @ApiProperty({ required: false, enum: ['name', 'message'] })
  @Transform(toUndefinedIfBlank)
  @IsOptional()
  @IsIn(['name', 'message'], {
    message: 'searchBy deve ser name ou message',
  })
  searchBy?: 'name' | 'message';
}

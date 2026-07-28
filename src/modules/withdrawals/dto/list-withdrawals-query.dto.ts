import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { WithdrawalStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional } from 'class-validator';

export class ListWithdrawalsQueryDto extends PaginationQueryDto {
  @ApiProperty({ required: false, example: '2026-04-01T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'startDate deve ser uma data válida' })
  startDate?: Date;

  @ApiProperty({ required: false, example: '2026-04-30T23:59:59.999Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'endDate deve ser uma data válida' })
  endDate?: Date;

  @ApiProperty({ enum: WithdrawalStatus, required: false })
  @IsOptional()
  @IsEnum(WithdrawalStatus, {
    message: 'status deve ser um status de saque válido',
  })
  status?: WithdrawalStatus;
}

import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { WithdrawalStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional } from 'class-validator';

export class ListWithdrawalsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @IsOptional()
  @IsEnum(WithdrawalStatus)
  @ApiProperty({ enum: WithdrawalStatus, required: false })
  status?: WithdrawalStatus;
}

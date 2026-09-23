import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { PaginationMetaDto } from 'src/common/dto/pagination.dto';
import { WithdrawalEntity } from './withdrawal.entity';

export class PaginatedWithdrawalResponse extends PaginatedResponseDto<WithdrawalEntity> {
  @ApiProperty({ type: [WithdrawalEntity] })
  declare items: WithdrawalEntity[];

  @ApiProperty({ type: PaginationMetaDto })
  declare meta: PaginationMetaDto;
}

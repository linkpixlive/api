import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { PaginationMetaDto } from 'src/common/dto/pagination.dto';
import { DonationHistoryEntity } from './donation-history.entity';

export class PaginatedDonationHistoryResponse extends PaginatedResponseDto<DonationHistoryEntity> {
  @ApiProperty({ type: [DonationHistoryEntity] })
  declare items: DonationHistoryEntity[];

  @ApiProperty({ type: PaginationMetaDto })
  declare meta: PaginationMetaDto;
}

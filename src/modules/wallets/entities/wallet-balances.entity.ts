import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';

@Exclude()
export class WalletBalancesEntity {
  @ApiProperty({ example: 100 })
  @Expose()
  @Transform(({ value }) => Number(value))
  available: number;

  @ApiProperty({ example: 100 })
  @Expose()
  @Transform(({ value }) => Number(value))
  blocked: number;

  @ApiProperty({ example: 100 })
  @Expose()
  @Transform(({ value }) => Number(value))
  pending: number;

  constructor(partial: Partial<WalletBalancesEntity>) {
    Object.assign(this, partial);
  }
}

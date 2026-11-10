import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class WithdrawalFeeEntity {
  @ApiProperty({
    example: 4,
    description:
      'Taxa de saque percentual aplicável ao usuário (personalizada ou global)',
  })
  @Expose()
  feePercentage: number;

  @ApiProperty({
    example: false,
    description: 'Indica se o usuário possui taxa personalizada de conta',
  })
  @Expose()
  isCustom: boolean;

  @ApiProperty({
    example: 1,
    description: 'Valor mínimo para solicitar um saque',
  })
  @Expose()
  minAmount: number;

  constructor(partial: Partial<WithdrawalFeeEntity>) {
    Object.assign(this, partial);
  }
}

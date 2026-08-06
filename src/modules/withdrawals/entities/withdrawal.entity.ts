import { ApiProperty } from '@nestjs/swagger';
import { WithdrawalStatus } from '@prisma/client';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class WithdrawalEntity {
  @ApiProperty({ example: 'uuid-123' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'uuid-456', nullable: true })
  @Expose()
  pixId: string | null;

  @ApiProperty({
    example: 'joh***@email.com',
    description: 'Valor mascarado da chave Pix',
  })
  @Expose()
  keyMasked: string;

  @ApiProperty({ example: 100.0 })
  @Expose()
  amount: number;

  @ApiProperty({ example: 96.0, description: 'Valor após taxas' })
  @Expose()
  netAmount: number;

  @ApiProperty({ example: 4.0, description: 'Valor da taxa' })
  @Expose()
  feeAmount: number;

  @ApiProperty({ enum: WithdrawalStatus, example: 'pending' })
  @Expose()
  status: string;

  @ApiProperty({ example: '2026-04-16T12:00:00.000Z' })
  @Expose()
  createdAt: Date;

  constructor(partial: Partial<WithdrawalEntity>) {
    Object.assign(this, partial);
  }
}

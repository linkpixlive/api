import { ApiProperty } from '@nestjs/swagger';
import { WithdrawalStatus } from '@prisma/client';

export class WithdrawalEntity {
  @ApiProperty({ example: 'uuid-123' })
  id: string;

  @ApiProperty({ example: 'uuid-456', nullable: true })
  pixId: string | null;

  @ApiProperty({
    example: 'johndoe@email.com',
    description: 'Pix key value',
  })
  pixValue: string;

  @ApiProperty({ example: 100.0 })
  amount: number;

  @ApiProperty({ example: 96.0, description: 'Amount after fees' })
  netAmount: number;

  @ApiProperty({ example: 4.0, description: 'Fee amount' })
  feeAmount: number;

  @ApiProperty({ enum: WithdrawalStatus, example: 'pending' })
  status: string;

  @ApiProperty({ example: '2026-04-16T12:00:00.000Z' })
  createdAt: Date;

  constructor(partial: Partial<WithdrawalEntity>) {
    Object.assign(this, partial);
  }
}

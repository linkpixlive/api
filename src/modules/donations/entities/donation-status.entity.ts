import { ApiProperty } from '@nestjs/swagger';
import { DonationStatus } from '@prisma/client';
import { Expose } from 'class-transformer';

export class DonationStatusEntity {
  @ApiProperty({ example: 'uuid-123' })
  @Expose()
  id: string;

  @ApiProperty({ enum: DonationStatus, example: 'pending' })
  @Expose()
  status: DonationStatus;

  @ApiProperty({ example: '2026-04-16T12:30:00.000Z', nullable: true })
  @Expose()
  expiredAt: Date | null;

  constructor(partial: Partial<DonationStatusEntity>) {
    Object.assign(this, partial);
  }
}

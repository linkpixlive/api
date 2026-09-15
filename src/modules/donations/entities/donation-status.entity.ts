import { ApiProperty } from '@nestjs/swagger';
import { DonationStatus } from '@prisma/client';
import { Expose, Transform } from 'class-transformer';

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

  @ApiProperty({ example: 'johndoe' })
  @Expose()
  streamerUsername: string;

  @ApiProperty({ example: 'John Doe' })
  @Expose()
  streamerName: string;

  @ApiProperty({ example: 'Keep up the good work!', nullable: true })
  @Expose()
  message: string | null;

  @ApiProperty({ example: 10 })
  @Expose()
  @Transform(({ value }) => Number(value))
  amount: number;

  constructor(partial: Partial<DonationStatusEntity>) {
    Object.assign(this, partial);
  }
}

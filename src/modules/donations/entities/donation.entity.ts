import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { DonationStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { Exclude, Expose, Transform } from 'class-transformer';

export class DonationEntity {
  @ApiProperty({ example: 'uuid-123' })
  @Expose()
  id: string;

  @Exclude()
  @ApiHideProperty()
  name: string;

  @ApiProperty({ example: 10 })
  @Expose()
  @Transform(({ value }) => Number(value))
  amount: Decimal;

  @Exclude()
  @ApiHideProperty()
  message: string | null;

  @ApiProperty({ example: 'voice-id-456', nullable: true })
  @Expose()
  audioId: string | null;

  @ApiProperty({ enum: DonationStatus, example: 'pending' })
  @Expose()
  status: DonationStatus;

  @ApiProperty({
    example: '00020126360014br.gov.bcb.pix...',
    description: 'PIX Copy/Paste code',
  })
  @Expose()
  pix: string | null;

  @ApiProperty({ example: '2026-04-16T12:00:00.000Z' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ example: '2026-04-16T12:30:00.000Z', nullable: true })
  @Expose()
  expiredAt: Date | null;

  @Exclude()
  @ApiHideProperty()
  transactionId: string;

  @Exclude()
  @ApiHideProperty()
  ip: string | null;

  @Exclude()
  @ApiHideProperty()
  userId: string;

  @Exclude()
  @ApiHideProperty()
  messageRaw: string | null;

  @Exclude()
  @ApiHideProperty()
  voiceUrl: string | null;

  @Exclude()
  @ApiHideProperty()
  voiceId: string | null;

  @Exclude()
  @ApiHideProperty()
  approvedAt: Date | null;

  @Exclude()
  @ApiHideProperty()
  paymentMethod: string;

  @Exclude()
  @ApiHideProperty()
  messageType: string | null;

  constructor(partial: Partial<DonationEntity>) {
    Object.assign(this, partial);
  }
}

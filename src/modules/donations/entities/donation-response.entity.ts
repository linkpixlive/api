import { ApiProperty } from '@nestjs/swagger';
import { Donation, DonationStatus } from '@prisma/client';

export class DonationResponseEntity {
  @ApiProperty({ example: 'uuid-123' })
  id: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ example: 10 })
  amount: number;

  @ApiProperty({ example: 'Keep up the good work!', nullable: true })
  message: string | null;

  @ApiProperty({ example: 'voice-id-456', nullable: true })
  voiceId: string | null;

  @ApiProperty({ enum: DonationStatus, example: 'pending' })
  status: DonationStatus;

  @ApiProperty({
    example: '00020126360014br.gov.bcb.pix...',
    description: 'PIX Copy/Paste code',
  })
  pix: string | null;

  @ApiProperty({ example: '2026-04-16T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-04-16T12:30:00.000Z', nullable: true })
  expiredAt: Date | null;

  constructor(partial: Partial<DonationResponseEntity>) {
    Object.assign(this, partial);
  }

  static toResponse(donation: Donation): DonationResponseEntity {
    return new DonationResponseEntity({
      id: donation.id,
      name: donation.name,
      amount: Number(donation.amount),
      message: donation.message_raw,
      voiceId: donation.voice_id,
      status: donation.status,
      pix: donation.pix,
      createdAt: donation.created_at,
      expiredAt: donation.expired_at,
    });
  }
}

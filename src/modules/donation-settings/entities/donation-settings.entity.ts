import { ApiProperty } from '@nestjs/swagger';
import { DonationSettings } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { Exclude, Expose, Transform } from 'class-transformer';

@Exclude()
export class DonationSettingsEntity implements DonationSettings {
  @ApiProperty({ example: 'uuid-123' })
  @Expose()
  id: string;

  @Exclude()
  userId: string;

  @ApiProperty({ example: 250 })
  @Expose()
  maxLength: number;

  @ApiProperty({ example: 5.0 })
  @Expose()
  @Transform(({ value }) => Number(value))
  minAudioAmount: Decimal;

  @ApiProperty({ example: 1.0 })
  @Expose()
  @Transform(({ value }) => Number(value))
  minTextAmount: Decimal;

  @ApiProperty({ example: true })
  @Expose()
  filterProfanity: boolean;

  @ApiProperty({ example: true })
  @Expose()
  filterSpam: boolean;

  @ApiProperty({ example: ['badword1', 'badword2'] })
  @Expose()
  blockedWords: string[];

  @ApiProperty({ example: 'uuid-voice-id', nullable: true })
  @Expose()
  defaultVoiceId: string | null;

  @ApiProperty({ example: '2026-04-16T12:00:00.000Z' })
  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<DonationSettingsEntity>) {
    Object.assign(this, partial);
  }
}

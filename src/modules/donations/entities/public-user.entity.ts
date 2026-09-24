import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { MAX_DONATION_AMOUNT } from 'src/common/constants/donation.constants';

@Exclude()
export class PublicUserEntity {
  @ApiProperty({ example: 'John Doe' })
  @Expose()
  name: string;

  @ApiProperty({ example: 'johndoe' })
  @Expose()
  username: string;

  @ApiProperty({ example: false, description: 'Se o streamer é verificado' })
  @Expose()
  verified: boolean;

  @ApiProperty({ example: 'https://example.com/avatar.jpg', nullable: true })
  @Expose()
  profileImageUrl: string | null;

  @ApiProperty({
    example: true,
    description: 'Whether the user is currently streaming/overlay is online',
  })
  @Expose()
  overlayActive: boolean;

  @ApiProperty({ example: 5.0 })
  @Expose()
  minAudioAmount: number;

  @ApiProperty({ example: 1.0 })
  @Expose()
  minTextAmount: number;

  @ApiProperty({ example: MAX_DONATION_AMOUNT, maximum: MAX_DONATION_AMOUNT })
  @Expose()
  maxDonationAmount: number;

  @ApiProperty({ example: 250, maximum: 250 })
  @Expose()
  maxLength: number;

  constructor(partial: Partial<PublicUserEntity>) {
    Object.assign(this, partial);
  }
}

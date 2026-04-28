import { ApiProperty } from '@nestjs/swagger';

export class PublicUserEntity {
  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ example: 'johndoe' })
  username: string;

  @ApiProperty({ example: 'https://example.com/avatar.jpg', nullable: true })
  profileImageUrl: string | null;

  @ApiProperty({
    example: true,
    description: 'Whether the user is currently streaming/overlay is online',
  })
  overlayActive: boolean;

  @ApiProperty({ example: 5.0 })
  minAudioAmount?: number;

  @ApiProperty({ example: 1.0 })
  minTextAmount?: number;

  @ApiProperty({ example: 250 })
  maxLength?: number;

  constructor(partial: Partial<PublicUserEntity>) {
    Object.assign(this, partial);
  }
}

import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class VoiceEntity {
  @ApiProperty({ example: 'uuid-123' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'Google Feminina PT-BR' })
  @Expose()
  name: string;

  @ApiProperty({ example: 'google' })
  @Expose()
  provider: string;

  @ApiProperty({ example: 'pt-BR-Standard-A' })
  @Expose()
  voiceId: string;

  @ApiProperty({ example: true })
  @Expose()
  isActive: boolean;

  @ApiProperty({
    example: 'https://cdn.example.com/voices/foto.png',
    nullable: true,
  })
  @Expose()
  photoUri: string | null;

  @ApiProperty({ example: '2026-04-16T12:00:00.000Z' })
  @Expose()
  createdAt: Date;

  constructor(partial: Partial<VoiceEntity>) {
    Object.assign(this, partial);
  }
}

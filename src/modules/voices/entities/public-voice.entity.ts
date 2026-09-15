import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class PublicVoiceEntity {
  @ApiProperty({ example: 'uuid-123' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'Google Feminina PT-BR' })
  @Expose()
  name: string;

  @ApiProperty({
    example: 'https://cdn.example.com/voices/foto.jpg',
    nullable: true,
    description: 'Imagem de exemplo da voz',
  })
  @Expose()
  photoUrl: string | null;

  @ApiProperty({
    example: 'https://cdn.example.com/voices/amostra.wav',
    nullable: true,
    description: 'Áudio de exemplo reproduzido no formulário de doação',
  })
  @Expose()
  sampleUrl: string | null;

  constructor(partial: Partial<PublicVoiceEntity>) {
    Object.assign(this, partial);
  }
}

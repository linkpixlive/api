import { ApiProperty } from '@nestjs/swagger';
import { PixKeyType } from '@prisma/client';

export class PixKeyEntity {
  @ApiProperty({ example: 'uuid-123' })
  id: string;

  @ApiProperty({
    example: 'johndoe@email.com',
    description: 'Decrypted Pix key value',
  })
  key?: string;

  @ApiProperty({ example: 'joh***@email.com' })
  keyMasked: string;

  @ApiProperty({ enum: PixKeyType, example: 'email' })
  keyType: string;

  @ApiProperty({ example: 'Primary Key', nullable: true })
  alias?: string;

  @ApiProperty({ example: '2026-04-16T12:00:00.000Z' })
  createdAt: Date;

  constructor(partial: Partial<PixKeyEntity>) {
    Object.assign(this, partial);
  }
}

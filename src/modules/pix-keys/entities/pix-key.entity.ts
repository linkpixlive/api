import { ApiProperty } from '@nestjs/swagger';
import { PixKeyType } from '@prisma/client';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class PixKeyEntity {
  @ApiProperty({ example: 'uuid-123' })
  @Expose()
  id: string;

  @ApiProperty({
    example: 'johndoe@email.com',
    description: 'Decrypted Pix key value',
  })
  @Expose()
  key?: string;

  @ApiProperty({ example: 'joh***@email.com' })
  @Expose()
  keyMasked: string;

  @ApiProperty({ enum: PixKeyType, example: 'email' })
  @Expose()
  keyType: string;

  @ApiProperty({ example: 'Primary Key', nullable: true })
  @Expose()
  alias?: string | null;

  @ApiProperty({ example: '2026-04-16T12:00:00.000Z' })
  @Expose()
  createdAt: Date;

  constructor(partial: Partial<PixKeyEntity>) {
    Object.assign(this, partial);
  }
}

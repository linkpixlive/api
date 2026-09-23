import { ApiProperty } from '@nestjs/swagger';

export class Pending2faDto {
  @ApiProperty({ example: true })
  requires2fa: boolean;

  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  nonce: string;
}

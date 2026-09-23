import { ApiProperty } from '@nestjs/swagger';

export class Setup2faEntity {
  @ApiProperty({
    example:
      'otpauth://totp/LinkPix:john@example.com?secret=JBSWY3DPEHPK3PXP&issuer=LinkPix',
  })
  otpauthUrl: string;

  @ApiProperty({ example: 'JBSWY3DPEHPK3PXP' })
  secret: string;
}

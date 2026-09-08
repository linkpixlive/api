import { ApiProperty } from '@nestjs/swagger';

export class UploadProfilePhotoDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  file: string;
}

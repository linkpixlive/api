import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { IsPixKey } from '../../../common/decorators/is-pix-key.decorator';

export class CreatePixKeyDto {
  @ApiProperty({
    example: 'johndoe@email.com',
    description: 'Pix key value',
    maxLength: 255,
  })
  @IsString()
  @IsPixKey({ message: 'Invalid Pix key format.' })
  @MaxLength(255)
  key: string;

  @ApiProperty({
    example: 'My Email Key',
    maxLength: 100,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  alias?: string;
}

import { IsOptional, IsString, MaxLength } from 'class-validator';
import { IsPixKey } from '../../../common/decorators/is-pix-key.decorator';

export class CreatePixKeyDto {
  @IsString()
  @IsPixKey({ message: 'Invalid Pix key format.' })
  @MaxLength(255)
  key: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  alias?: string;
}

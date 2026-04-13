import {
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { SanitizeHTML } from 'src/common/decorators/sanitize.decorator';

export class DonationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @SanitizeHTML()
  name: string;

  @IsString()
  @MaxLength(250)
  @SanitizeHTML()
  message: string;

  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  @IsNotEmpty()
  voice_id: string;

  @IsString()
  @IsNotEmpty()
  username: string;
}

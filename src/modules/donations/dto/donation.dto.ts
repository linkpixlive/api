import {
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SanitizeHTML } from 'src/common/decorators/sanitize.decorator';

export class DonationDto {
  @ApiProperty({ example: 'John Doe', maxLength: 100 })
  @MaxLength(100)
  @SanitizeHTML()
  name: string;

  @ApiProperty({ example: 'Keep up the good work!', maxLength: 250 })
  @IsString()
  @MaxLength(250)
  @SanitizeHTML()
  message: string;

  @ApiProperty({ example: 10, minimum: 1 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ example: 'voice-id-123' })
  @IsString()
  @IsNotEmpty()
  voiceId: string;

  @ApiProperty({ example: 'streamer_username' })
  @IsString()
  @IsNotEmpty()
  username: string;
}

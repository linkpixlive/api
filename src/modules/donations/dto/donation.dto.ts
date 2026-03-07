import { IsNumber, IsString } from 'class-validator';

export class DonationDto {
  @IsString()
  name: string;

  @IsString()
  message: string;

  @IsNumber()
  amount: number;

  @IsString()
  voice_id: string;

  @IsString()
  user_id: string;
}

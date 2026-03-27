import { IsEmail, IsString } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  otp: string;

  @IsEmail()
  email: string;
}

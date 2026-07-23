import { IsBoolean, IsNotEmpty } from 'class-validator';

export class VerifyUserDto {
  @IsBoolean()
  @IsNotEmpty()
  verified: boolean;
}

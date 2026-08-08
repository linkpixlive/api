import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsUUID, Length } from 'class-validator';

export class Login2faDto {
  @ApiProperty({ example: 'johndoe@email.com' })
  @IsString()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'P@ssword123' })
  @IsString()
  password: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  totp: string;

  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID('4')
  nonce: string;
}

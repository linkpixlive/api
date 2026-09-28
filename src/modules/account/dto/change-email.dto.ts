import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class ChangeEmailDto {
  @ApiProperty({ example: 'johndoe@email.com' })
  @IsString()
  @IsEmail()
  @MaxLength(100)
  email: string;

  @ApiProperty({ example: 'P@ssword123', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  password?: string;

  @ApiProperty({ example: '123456', required: false })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  totp?: string;
}

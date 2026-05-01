import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNumberString,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterAuthDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'Full name of the user',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name: string;

  @ApiProperty({
    example: 'johndoe',
    description: 'Unique alphanumeric username',
  })
  @IsString()
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username must be alphanumeric' })
  @MinLength(3)
  @MaxLength(30)
  username: string;

  @ApiProperty({
    example: 'johndoe@email.com',
    description: 'Valid email address',
  })
  @IsString()
  @IsEmail()
  @MaxLength(100)
  email: string;

  @ApiProperty({
    example: 'P@ssword123',
    description:
      'Password (min 8 chars, must contain upper, lower, number or special)',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(36)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password too weak. Use uppercase, numbers, and special characters.',
  })
  password: string;

  @ApiProperty({
    example: '12345678901',
    description: 'CPF (11 digits, numbers only)',
  })
  @IsNumberString()
  @Length(11, 11)
  cpf: string;
}

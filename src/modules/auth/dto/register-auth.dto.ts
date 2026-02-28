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
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username must be alphanumeric' })
  @MinLength(3)
  @MaxLength(30)
  username: string;

  @IsString()
  @IsEmail()
  @MaxLength(100)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(36)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password too weak. Use uppercase, numbers, and special characters.',
  })
  password: string;

  @IsNumberString()
  @Length(11, 11)
  cpf: string;
}

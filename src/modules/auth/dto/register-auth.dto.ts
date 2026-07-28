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
    description: 'Nome completo do usuário',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name: string;

  @ApiProperty({
    example: 'johndoe',
    description: 'Nome de usuário alfanumérico único',
  })
  @IsString()
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Nome de usuário deve ser alfanumérico',
  })
  @MinLength(3)
  @MaxLength(30)
  username: string;

  @ApiProperty({
    example: 'johndoe@email.com',
    description: 'Endereço de email válido',
  })
  @IsString()
  @IsEmail()
  @MaxLength(100)
  email: string;

  @ApiProperty({
    example: 'P@ssword123',
    description:
      'Senha (mín 8 caracteres, deve conter maiúscula, minúscula, número ou especial)',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(36)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Senha muito fraca. Use maiúsculas, números e caracteres especiais.',
  })
  password: string;

  @ApiProperty({
    example: '12345678901',
    description: 'CPF (11 dígitos, apenas números)',
  })
  @IsNumberString()
  @Length(11, 11)
  cpf: string;
}

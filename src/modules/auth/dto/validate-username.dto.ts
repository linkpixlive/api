import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ValidateUsernameDto {
  @ApiProperty({
    example: 'johndoe',
    description: 'Nome de usuário alfanumérico a validar',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Nome de usuário deve conter apenas letras, números e underscores',
  })
  @MinLength(3)
  @MaxLength(30)
  username: string;
}

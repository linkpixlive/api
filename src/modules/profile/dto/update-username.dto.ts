import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateUsernameDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Nome de usuário deve ser alfanumérico',
  })
  @MinLength(3)
  @MaxLength(30)
  newUsername: string;
}

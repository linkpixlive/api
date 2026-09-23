import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldP@ssword123' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({
    example: 'NewP@ssword123',
    description:
      'Nova senha (mín 8 caracteres, deve conter maiúscula, minúscula, número ou especial)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(36)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Senha muito fraca. Use maiúsculas, números e caracteres especiais.',
  })
  newPassword: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'reset-token-123' })
  @IsString()
  token: string;

  @ApiProperty({
    example: 'NewP@ssword123',
    description: 'Nova senha para a conta',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(36)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Senha muito fraca. Use maiúsculas, números e caracteres especiais.',
  })
  newPassword: string;
}

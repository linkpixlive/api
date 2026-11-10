import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength } from 'class-validator';

export class RegisterInitDto {
  @ApiProperty({
    example: 'johndoe@email.com',
    description: 'E-mail do novo usuário (receberá o código de verificação)',
  })
  @IsString()
  @IsEmail()
  @MaxLength(100)
  email: string;
}

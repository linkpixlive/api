import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class DeactivateAccountDto {
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

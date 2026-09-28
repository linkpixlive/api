import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class Setup2faDto {
  @ApiProperty({ example: 'P@ssword123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateWithdrawalDto {
  @ApiProperty({ example: 100.0, minimum: 1 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ example: 'uuid-pix-key-123' })
  @IsString()
  @IsNotEmpty()
  pixId: string;
}

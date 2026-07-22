import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateWithdrawalDto {
  @ApiProperty({ example: 100.0, minimum: 1 })
  @IsNumber({}, { message: 'amount deve ser um número' })
  @Min(1, { message: 'amount deve ser no mínimo 1' })
  amount: number;

  @ApiProperty({ example: 'uuid-pix-key-123' })
  @IsString({ message: 'pixId deve ser uma string' })
  @IsNotEmpty({ message: 'pixId não pode estar vazio' })
  pixId: string;
}

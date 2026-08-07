import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateWithdrawalDto {
  @ApiProperty({ example: 100.0, minimum: 1 })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'amount deve ser um número com até 2 casas decimais' },
  )
  @IsPositive({ message: 'amount deve ser positivo' })
  @Min(1, { message: 'amount deve ser no mínimo 1' })
  @Max(999999.99, { message: 'amount deve ser no máximo 999999.99' })
  amount: number;

  @ApiProperty({ example: 'uuid-pix-key-123' })
  @IsString({ message: 'pixId deve ser uma string' })
  @IsNotEmpty({ message: 'pixId não pode estar vazio' })
  pixId: string;
}

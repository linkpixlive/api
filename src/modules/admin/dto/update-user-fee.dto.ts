import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateUserFeeDto {
  @ApiProperty({
    example: 2.5,
    nullable: true,
    description:
      'Taxa de saque personalizada da conta (0–100). Envie null para remover e voltar à taxa global.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  withdrawalFeePercentage?: number | null;
}

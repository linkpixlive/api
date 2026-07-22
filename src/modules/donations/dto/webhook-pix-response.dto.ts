import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class WebhookPixResponseDto {
  @ApiProperty({ example: '7d9834...' })
  @IsString({ message: 'O txid deve ser uma string' })
  txid: string;
}

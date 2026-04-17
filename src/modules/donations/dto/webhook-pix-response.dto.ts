import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class WebhookPixResponseDto {
  @ApiProperty({ example: '7d9834...' })
  @IsString()
  txid: string;
}

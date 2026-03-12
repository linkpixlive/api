import { IsString } from 'class-validator';

export class WebhookPixResponseDto {
  @IsString()
  txid: string;
}

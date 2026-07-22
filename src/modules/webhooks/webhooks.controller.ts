import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorators/isPublic';
import { DonationsService } from '../donations/donations.service';
import { WithdrawalsService } from '../withdrawals/withdrawals.service';

@ApiTags('Webhooks')
@Public()
@Controller()
export class WebhooksController {
  constructor(
    private readonly configService: ConfigService,
    private readonly donationsService: DonationsService,
    private readonly withdrawalsService: WithdrawalsService,
  ) {}

  @Post('webhook/pix')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'O webhook Pix é ativado quando uma atualização de pagamento é identificada no gateway.',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook recebido com sucesso.',
  })
  @ApiResponse({
    status: 401,
    description: 'Não autorizado (HMAC inválido)',
  })
  async webhookPix(
    @Query('hmac') hmac: string,
    @Body() body: { pix: Record<string, unknown>[] },
  ) {
    const secret = this.configService.get<string>('EFI_WEBHOOK_SECRET');

    if (hmac !== secret) {
      throw new UnauthorizedException('Segredo HMAC inválido');
    }

    const transactions = body.pix || [];

    for (const transaction of transactions) {
      const gnExtras = transaction.gnExtras as { idEnvio?: string } | undefined;

      if (gnExtras?.idEnvio) {
        await this.withdrawalsService.handleWebhookPixSend(gnExtras.idEnvio);
      } else if (transaction.txid) {
        await this.donationsService.webhookPix(transaction.txid as string);
      }
    }

    return 'ok';
  }
}

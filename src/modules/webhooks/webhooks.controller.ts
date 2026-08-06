import {
  BadRequestException,
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
import { Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'node:crypto';
import { Public } from 'src/common/decorators/isPublic';
import { DonationsService } from '../donations/donations.service';
import { WithdrawalsService } from '../withdrawals/withdrawals.service';

@ApiTags('Webhooks')
@Public()
@Controller()
export class WebhooksController {
  private static readonly MAX_WEBHOOK_BATCH = 5;

  constructor(
    private readonly configService: ConfigService,
    private readonly donationsService: DonationsService,
    private readonly withdrawalsService: WithdrawalsService,
  ) {}

  @Post('webhook/pix')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    webhook_burst: { limit: 5, ttl: 1000 },
    webhook_sustained: { limit: 20, ttl: 60000 },
  })
  @ApiOperation({
    summary:
      'O webhook Pix é ativado quando uma atualização de pagamento é identificada no gateway.',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook recebido com sucesso.',
  })
  @ApiResponse({
    status: 400,
    description: 'Lote de webhook excede o tamanho máximo permitido.',
  })
  @ApiResponse({
    status: 401,
    description: 'Não autorizado (HMAC inválido)',
  })
  @ApiResponse({
    status: 429,
    description: 'Muitas requisições.',
  })
  async webhookPix(
    @Query('hmac') hmac: string,
    @Body() body: { pix: Record<string, unknown>[] },
  ) {
    const secret = this.configService.getOrThrow<string>('EFI_WEBHOOK_SECRET');

    const hmacBuffer = Buffer.from(hmac ?? '', 'utf8');
    const secretBuffer = Buffer.from(secret, 'utf8');

    const isValid =
      hmacBuffer.length === secretBuffer.length &&
      timingSafeEqual(hmacBuffer, secretBuffer);

    if (!isValid) {
      throw new UnauthorizedException('Segredo HMAC inválido');
    }

    const transactions = body.pix || [];

    if (transactions.length > WebhooksController.MAX_WEBHOOK_BATCH) {
      throw new BadRequestException(
        `Lote excede o limite de ${WebhooksController.MAX_WEBHOOK_BATCH} transações.`,
      );
    }

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

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { DonationsService } from '../donations/donations.service';
import { WithdrawalsService } from '../withdrawals/withdrawals.service';
import { WebhooksController } from './webhooks.controller';

describe('WebhooksController', () => {
  const WEBHOOK_SECRET = 'meu-segredo';

  let configService: { getOrThrow: jest.Mock };
  let donationsService: { webhookPix: jest.Mock };
  let withdrawalsService: { handleWebhookPixSend: jest.Mock };
  let controller: WebhooksController;

  beforeEach(() => {
    configService = { getOrThrow: jest.fn().mockReturnValue(WEBHOOK_SECRET) };
    donationsService = { webhookPix: jest.fn() };
    withdrawalsService = { handleWebhookPixSend: jest.fn() };
    controller = new WebhooksController(
      configService as never,
      donationsService as unknown as DonationsService,
      withdrawalsService as unknown as WithdrawalsService,
    );
  });

  const call = (body: { pix?: Record<string, unknown>[] }, hmac?: string) =>
    controller.webhookPix(hmac as unknown as string, body as never);

  describe('autenticação (isValidSecret)', () => {
    it('rejeita hmac ausente', async () => {
      await expect(call({ pix: [] })).rejects.toThrow(UnauthorizedException);
      expect(donationsService.webhookPix).not.toHaveBeenCalled();
      expect(withdrawalsService.handleWebhookPixSend).not.toHaveBeenCalled();
    });

    it('rejeita hmac errado', async () => {
      await expect(call({ pix: [] }, 'segredo-errado')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejeita hmac com mesmo prefixo mas comprimento diferente', async () => {
      await expect(
        call({ pix: [] }, WEBHOOK_SECRET.slice(0, 4)),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('aceita hmac correto', async () => {
      await expect(call({ pix: [] }, WEBHOOK_SECRET)).resolves.toBe('ok');
    });
  });

  describe('limite de lote', () => {
    const batch = (n: number) => ({
      pix: Array.from({ length: n }, (_, i) => ({ txid: `tx-${i}` })),
    });

    it('aceita lote com até 5 transações', async () => {
      await expect(call(batch(5), WEBHOOK_SECRET)).resolves.toBe('ok');
      expect(donationsService.webhookPix).toHaveBeenCalledTimes(5);
    });

    it('rejeita lote com mais de 5 transações sem processar nada', async () => {
      await expect(call(batch(6), WEBHOOK_SECRET)).rejects.toThrow(
        BadRequestException,
      );
      expect(donationsService.webhookPix).not.toHaveBeenCalled();
    });

    it('trata body sem pix como lote vazio', async () => {
      await expect(call({}, WEBHOOK_SECRET)).resolves.toBe('ok');
      expect(donationsService.webhookPix).not.toHaveBeenCalled();
    });
  });

  describe('roteamento', () => {
    it('rota transação com gnExtras.idEnvio para saques', async () => {
      await call(
        { pix: [{ gnExtras: { idEnvio: 'abc123' } }] },
        WEBHOOK_SECRET,
      );

      expect(withdrawalsService.handleWebhookPixSend).toHaveBeenCalledWith(
        'abc123',
      );
      expect(donationsService.webhookPix).not.toHaveBeenCalled();
    });

    it('rota transação com txid para doações', async () => {
      await call({ pix: [{ txid: 'tx-1' }] }, WEBHOOK_SECRET);

      expect(donationsService.webhookPix).toHaveBeenCalledWith('tx-1');
      expect(withdrawalsService.handleWebhookPixSend).not.toHaveBeenCalled();
    });

    it('idEnvio tem precedência sobre txid', async () => {
      await call(
        { pix: [{ gnExtras: { idEnvio: 'w-1' }, txid: 'tx-1' }] },
        WEBHOOK_SECRET,
      );

      expect(withdrawalsService.handleWebhookPixSend).toHaveBeenCalledWith(
        'w-1',
      );
      expect(donationsService.webhookPix).not.toHaveBeenCalled();
    });

    it('transação sem idEnvio nem txid é ignorada', async () => {
      await call({ pix: [{ outro: 'campo' }] }, WEBHOOK_SECRET);

      expect(donationsService.webhookPix).not.toHaveBeenCalled();
      expect(withdrawalsService.handleWebhookPixSend).not.toHaveBeenCalled();
    });

    it('processa lote misto chamando cada serviço para sua rota', async () => {
      await call(
        {
          pix: [
            { gnExtras: { idEnvio: 'w-1' } },
            { txid: 'tx-1' },
            { txid: 'tx-2' },
          ],
        },
        WEBHOOK_SECRET,
      );

      expect(withdrawalsService.handleWebhookPixSend).toHaveBeenCalledTimes(1);
      expect(donationsService.webhookPix).toHaveBeenCalledTimes(2);
    });
  });
});

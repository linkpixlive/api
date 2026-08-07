import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import { firstValueFrom } from 'rxjs';
import { SentPixStatus } from 'src/common/interfaces/sent-pix-status.type';
import { TransactionStatus } from 'src/common/interfaces/transaction-status.type';
import { GatewayResponseRepository } from 'src/infra/db/repositories/gateway-response.repositories';
import { GatewayContract } from '../contract/gateway.contract';
import {
  EfiPixResponse,
  EfiSendPixResponse,
  EfiSentPixStatusResponse,
  EfiTokenResponse,
} from './efi.interface';

@Injectable()
export class EfiService extends GatewayContract {
  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly gatewayResponseRepository: GatewayResponseRepository,
  ) {
    super();

    this.httpsAgent = new https.Agent({
      pfx: Buffer.from(
        this.configService.get<string>('EFI_CERTIFICATE_BASE64') || '',
        'base64',
      ),
      passphrase: '',
    });
  }

  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private httpsAgent: https.Agent;

  async generatePix({
    amount,
    secondsToExpire,
  }: {
    amount: number;
    secondsToExpire?: number;
  }) {
    const expiration =
      secondsToExpire ??
      this.configService.getOrThrow<number>('PIX_EXPIRATION_SECONDS');
    const token = await this.getAccessToken();

    const { data, status } = await firstValueFrom(
      this.httpService.post<EfiPixResponse>(
        `${this.configService.get('EFI_API_URL')}/v2/cob`,
        {
          calendario: {
            expiracao: expiration,
          },
          valor: {
            original: amount.toFixed(2),
          },
          chave: this.configService.get<string>('EFI_PIX_KEY'),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          httpsAgent: this.httpsAgent,
        },
      ),
    );

    await this.gatewayResponseRepository.create({
      interactionType: 'GENERATE_DONATION_QRCODE',
      externalId: data.txid,
      payload: JSON.stringify(data),
      provider: 'efi',
      statusCode: status,
    });

    const createdDate = new Date(data.calendario.criacao);
    const expiredAt = new Date(
      createdDate.getTime() + data.calendario.expiracao * 1000,
    );

    return {
      pix: data.pixCopiaECola,
      transactionId: data.txid,
      expiredAt,
    };
  }

  async getPixStatus(transactionId: string): Promise<{
    status: TransactionStatus;
    paidAmount?: number;
  }> {
    const token = await this.getAccessToken();

    const {
      data,
      status,
    }: {
      data: {
        status: string;
        txid: string;
        valor?: { original?: string };
      };
      status: number;
    } = await firstValueFrom(
      this.httpService.get(
        `${this.configService.get('EFI_API_URL')}/v2/cob/${transactionId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          httpsAgent: this.httpsAgent,
        },
      ),
    );

    await this.gatewayResponseRepository.create({
      interactionType: 'RESPONSE_WEBHOOK_PIX',
      externalId: data.txid,
      payload: JSON.stringify(data),
      provider: 'efi',
      statusCode: status,
    });

    const paidAmount =
      data.status === 'CONCLUIDA' && data.valor?.original
        ? Number(data.valor.original)
        : undefined;

    switch (data.status) {
      case 'ATIVA':
        return { status: TransactionStatus.PENDING };
      case 'CONCLUIDA':
        return { status: TransactionStatus.PAID, paidAmount };
      case 'REMOVIDA_PELO_USUARIO_RECEBEDOR':
      case 'REMOVIDA_PELO_PSP':
        return { status: TransactionStatus.FAILED };
      default:
        return { status: TransactionStatus.PENDING };
    }
  }

  private mapEfiSentPixStatus(efiStatus: string): SentPixStatus {
    switch (efiStatus) {
      case 'REALIZADO':
      case 'CONCLUIDO':
        return SentPixStatus.SUCCESS;
      case 'NAO_REALIZADO':
      case 'REJEITADO':
        return SentPixStatus.FAILED;
      case 'EM_PROCESSAMENTO':
      default:
        return SentPixStatus.PROCESSING;
    }
  }

  async sendPix({
    idempotencyId,
    amount,
    pixDestination,
  }: {
    idempotencyId: string;
    amount: number;
    pixDestination: string;
  }): Promise<{ status: SentPixStatus; transactionId?: string }> {
    const token = await this.getAccessToken();

    const { data, status } = await firstValueFrom(
      this.httpService.put<EfiSendPixResponse>(
        `${this.configService.get('EFI_API_URL')}/v3/gn/pix/${idempotencyId}`,
        {
          valor: amount.toFixed(2),
          pagador: {
            chave: this.configService.get('EFI_PIX_KEY') as string,
          },
          favorecido: {
            chave: pixDestination,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          httpsAgent: this.httpsAgent,
        },
      ),
    );

    await this.gatewayResponseRepository.create({
      interactionType: 'REQUEST_WITHDRAWAL',
      externalId: idempotencyId,
      payload: JSON.stringify(data),
      provider: 'efi',
      statusCode: status,
    });

    return {
      status: this.mapEfiSentPixStatus(data.status),
      transactionId: data.e2eId,
    };
  }

  async getSentPixStatus(
    idempotencyId: string,
  ): Promise<{ status: SentPixStatus; transactionId?: string }> {
    const token = await this.getAccessToken();

    const { data, status } = await firstValueFrom(
      this.httpService.get<EfiSentPixStatusResponse>(
        `${this.configService.get('EFI_API_URL')}/v2/gn/pix/enviados/id-envio/${idempotencyId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          httpsAgent: this.httpsAgent,
        },
      ),
    );

    await this.gatewayResponseRepository.create({
      interactionType: 'RESPONSE_WEBHOOK_WITHDRAWAL',
      externalId: idempotencyId,
      payload: JSON.stringify(data),
      provider: 'efi',
      statusCode: status,
    });

    return {
      status: this.mapEfiSentPixStatus(data.status),
      transactionId: data.endToEndId,
    };
  }

  private async getAccessToken() {
    if (this.cachedToken && this.tokenExpiresAt > Date.now() + 60000) {
      return this.cachedToken;
    }

    const { token, expiresIn } = await this.generateAccessToken();

    this.cachedToken = token;
    this.tokenExpiresAt = Date.now() + expiresIn * 1000;

    return token;
  }

  private async generateAccessToken(): Promise<{
    token: string;
    expiresIn: number;
  }> {
    const clientId = this.configService.get<string>('EFI_CLIENT_ID');
    const clientSecret = this.configService.get<string>('EFI_CLIENT_SECRET');
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const { data } = await firstValueFrom(
      this.httpService.post<EfiTokenResponse>(
        `${this.configService.get('EFI_API_URL')}/oauth/token`,
        { grant_type: 'client_credentials' },
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          httpsAgent: this.httpsAgent,
        },
      ),
    );

    return {
      token: data.access_token,
      expiresIn: data.expires_in,
    };
  }
}

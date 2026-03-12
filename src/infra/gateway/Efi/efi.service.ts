import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import { firstValueFrom } from 'rxjs';
import { TransactionStatus } from 'src/common/interfaces/transaction-status.type';
import { GatewayContract } from '../contract/gateway.contract';
import { EfiPixResponse, EfiTokenResponse } from './efi.interface';

@Injectable()
export class EfiService extends GatewayContract {
  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
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
    secondsToExpire = 900,
  }: {
    amount: number;
    secondsToExpire?: number;
  }) {
    const token = await this.getAccessToken();

    const { data } = await firstValueFrom(
      this.httpService.post<EfiPixResponse>(
        `${this.configService.get('EFI_API_URL')}/v2/cob`,
        {
          calendario: {
            expiracao: secondsToExpire,
          },
          valor: {
            original: String(amount),
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

  async getPixStatus(transactionId: string): Promise<TransactionStatus> {
    const token = await this.getAccessToken();

    const { data }: { data: { status: string } } = await firstValueFrom(
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

    switch (data.status) {
      case 'ATIVA':
        return TransactionStatus.PENDING;
      case 'CONCLUIDA':
        return TransactionStatus.PAID;
      case 'REMOVIDA_PELO_USUARIO_RECEBEDOR':
      case 'REMOVIDA_PELO_PSP':
        return TransactionStatus.FAILED;
      default:
        return TransactionStatus.PENDING;
    }
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

import { SentPixStatus } from 'src/common/interfaces/sent-pix-status.type';
import { TransactionStatus } from 'src/common/interfaces/transaction-status.type';

export abstract class GatewayContract {
  abstract generatePix(params: {
    amount: number;
    secondsToExpire?: number;
  }): Promise<{ pix: string; transactionId: string; expiredAt: Date }>;

  abstract getPixStatus(transactionId: string): Promise<TransactionStatus>;

  abstract sendPix(params: {
    idempotencyId: string;
    amount: number;
    pixDestination: string;
  }): Promise<{ status: SentPixStatus; transactionId?: string }>;

  abstract getSentPixStatus(
    idempotencyId: string,
  ): Promise<{ status: SentPixStatus; transactionId?: string }>;
}

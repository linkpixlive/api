import { TransactionStatus } from 'src/common/interfaces/transaction-status.type';

export abstract class GatewayContract {
  abstract generatePix(params: {
    amount: number;
    secondsToExpire?: number;
  }): Promise<{ pix: string; transactionId: string; expiredAt: Date }>;

  abstract getPixStatus(transactionId: string): Promise<TransactionStatus>;
}

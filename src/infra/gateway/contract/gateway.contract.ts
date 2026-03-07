export abstract class GatewayContract {
  abstract generatePix(params: {
    amount: number;
    secondsToExpire?: number;
  }): Promise<{ pix: string; transactionId: string; expiredAt: Date }>;
}

import { Decimal } from '@prisma/client/runtime/client';

export interface FindWalletParams {
  userId: string;
}

export interface ReconcileResult {
  userId: string;
  walletBalance: Decimal;
  ledgerBalance: Decimal;
  chainValid: boolean;
  match: boolean;
}

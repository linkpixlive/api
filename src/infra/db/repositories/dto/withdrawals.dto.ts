import { WithdrawalStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';

export interface CreateWithdrawalParams {
  userId: string;
  pixId: string;
  pixKey: string;
  keyMasked: string;
  grossAmount: number;
  netAmount: number | Decimal;
  feeAmount: number | Decimal;
  clientKey?: string | null;
}

export interface FindWithdrawalsParams {
  userId: string;
  startDate?: Date;
  endDate?: Date;
  status?: WithdrawalStatus;
  page: number;
  limit: number;
}

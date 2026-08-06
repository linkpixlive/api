import { WithdrawalStatus } from '@prisma/client';

export interface CreateWithdrawalParams {
  userId: string;
  pixId: string;
  pixKey: string;
  keyMasked: string;
  grossAmount: number;
  netAmount: number;
  feeAmount: number;
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

import { WithdrawalStatus } from '@prisma/client';

export interface CreateWithdrawalParams {
  userId: string;
  pixId: string;
  pixKey: string;
  grossAmount: number;
  netAmount: number;
  feeAmount: number;
}

export interface FindWithdrawalsParams {
  userId: string;
  startDate?: Date;
  endDate?: Date;
  status?: WithdrawalStatus;
  page: number;
  limit: number;
}

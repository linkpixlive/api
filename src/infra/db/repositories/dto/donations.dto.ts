import { Decimal } from '@prisma/client/runtime/client';

export interface CreateDonationParams {
  userId: string;
  name: string;
  amount: Decimal;
  transactionId: string;
  paymentMethod: 'pix';
  ip?: string;
  voiceId?: string | null;
  pix?: string;
  status?: 'pending' | 'paid' | 'displayed' | 'failed' | 'expired';
  expiredAt?: Date;
  approvedAt?: Date;
  messageType?: 'audio' | 'text';
  message?: string;
  voiceUrl?: string;
}

export type DonationHistoryDays = 7 | 15 | 30 | 'today';

export interface GetDonationHistoryParams {
  userId: string;
  page: number;
  limit: number;
  status?: 'paid' | 'displayed';
  days?: DonationHistoryDays;
  search?: string;
  searchBy?: 'name' | 'message';
}

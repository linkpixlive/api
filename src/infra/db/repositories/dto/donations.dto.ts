export interface CreateDonationParams {
  userId: string;
  name: string;
  amount: number;
  transactionId: string;
  paymentMethod: 'pix';
  ip?: string;
  messageRaw?: string;
  voiceId?: string;
  pix?: string;
  status?: 'pending' | 'paid' | 'displayed' | 'failed' | 'expired';
  expiredAt?: Date;
  approvedAt?: Date;
  messageType?: 'audio' | 'text';
  message?: string;
  voiceUrl?: string;
}

export interface UpdateDonationParams {
  name?: string;
  amount?: number;
  ip?: string;
  messageRaw?: string;
  voiceId?: string;
  pix?: string;
  status?: 'pending' | 'paid' | 'displayed' | 'failed' | 'expired';
  expiredAt?: Date;
  approvedAt?: Date;
  paymentMethod?: 'pix';
  transactionId?: string;
  messageType?: 'audio' | 'text';
  message?: string;
  voiceUrl?: string;
}

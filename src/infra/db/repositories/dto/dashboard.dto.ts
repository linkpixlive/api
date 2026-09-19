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

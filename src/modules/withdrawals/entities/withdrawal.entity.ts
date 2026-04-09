export class WithdrawalEntity {
  id: string;
  pixId: string | null;
  pixValue: string;
  amount: number;
  netAmount: number;
  feeAmount: number;
  status: string;
  createdAt: Date;

  constructor(partial: Partial<WithdrawalEntity>) {
    Object.assign(this, partial);
  }
}

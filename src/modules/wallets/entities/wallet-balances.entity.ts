export class WalletBalancesEntity {
  available: number;
  blocked: number;
  pending: number;

  constructor(partial: Partial<WalletBalancesEntity>) {
    Object.assign(this, partial);
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { WalletsRepository } from '../../infra/db/repositories/wallets.repositories';
import { SafeUser } from '../auth/entities/safe-user.entity';
import { WalletBalancesEntity } from './entities/wallet-balances.entity';

@Injectable()
export class WalletsService {
  constructor(private walletsRepository: WalletsRepository) {}

  async getBalances(user: SafeUser): Promise<WalletBalancesEntity> {
    const wallet = await this.walletsRepository.findByUserId({
      userId: user.id,
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found.');
    }

    const currentBalance = Number(wallet.current_balance);
    const blockedBalance = Number(wallet.blocked_balance);
    const pendingBalance = Number(wallet.pending_balance);

    return new WalletBalancesEntity({
      available: currentBalance,
      blocked: blockedBalance,
      pending: pendingBalance,
    });
  }
}

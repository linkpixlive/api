import { Injectable, NotFoundException } from '@nestjs/common';
import { WalletsRepository } from '../../infra/db/repositories/wallets.repositories';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { WalletBalancesEntity } from './entities/wallet-balances.entity';

@Injectable()
export class WalletsService {
  constructor(private walletsRepository: WalletsRepository) {}

  async getBalances(user: AuthenticatedUser): Promise<WalletBalancesEntity> {
    const wallet = await this.walletsRepository.findByUserId({
      userId: user.id,
    });

    if (!wallet) {
      throw new NotFoundException('Carteira não encontrada.');
    }

    const currentBalance = Number(wallet.currentBalance);
    const blockedBalance = Number(wallet.blockedBalance);
    const pendingBalance = Number(wallet.pendingBalance);

    return new WalletBalancesEntity({
      available: currentBalance,
      blocked: blockedBalance,
      pending: pendingBalance,
    });
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Withdrawal } from '@prisma/client';
import { PixKeysRepository } from '../../infra/db/repositories/pix-keys.repositories';
import { WalletsRepository } from '../../infra/db/repositories/wallets.repositories';
import { WithdrawalsRepository } from '../../infra/db/repositories/withdrawals.repositories';
import { SafeUser } from '../auth/entities/safe-user.entity';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { ListWithdrawalsQueryDto } from './dto/list-withdrawals-query.dto';
import { WithdrawalEntity } from './entities/withdrawal.entity';

const FEE_PERCENTAGE = 4;

@Injectable()
export class WithdrawalsService {
  constructor(
    private withdrawalsRepository: WithdrawalsRepository,
    private walletsRepository: WalletsRepository,
    private pixKeysRepository: PixKeysRepository,
  ) {}

  async create(
    user: SafeUser,
    dto: CreateWithdrawalDto,
  ): Promise<WithdrawalEntity> {
    const wallet = await this.walletsRepository.findByUserId({
      userId: user.id,
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found.');
    }

    const availableBalance = wallet.current_balance.toNumber();

    if (dto.amount > availableBalance) {
      throw new BadRequestException('Insufficient available balance.');
    }

    const pixKey = await this.pixKeysRepository.findById(dto.pixId);

    if (!pixKey || pixKey.user_id !== user.id) {
      throw new NotFoundException('Pix key not found.');
    }

    const feeAmount = +(dto.amount * (FEE_PERCENTAGE / 100)).toFixed(2);
    const netAmount = +(dto.amount - feeAmount).toFixed(2);

    const withdrawal = await this.withdrawalsRepository.processWithdrawal({
      userId: user.id,
      pixId: pixKey.id,
      pixKey: pixKey.key_value,
      grossAmount: dto.amount,
      netAmount,
      feeAmount,
    });

    return this.mapToEntity(withdrawal);
  }

  async findAll(user: SafeUser, query: ListWithdrawalsQueryDto) {
    const result = await this.withdrawalsRepository.findByUserId({
      userId: user.id,
      startDate: query.startDate,
      endDate: query.endDate,
      status: query.status,
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    });

    return {
      ...result,
      data: result.data.map((w: Withdrawal) => this.mapToEntity(w)),
    };
  }

  private mapToEntity(withdrawal: Withdrawal): WithdrawalEntity {
    return new WithdrawalEntity({
      id: withdrawal.id,
      pixId: withdrawal.pix_id,
      pixValue: withdrawal.pix_value,
      amount: Number(withdrawal.gross_amount),
      netAmount: Number(withdrawal.net_amount),
      feeAmount: Number(withdrawal.fee_amount),
      status: withdrawal.status,
      createdAt: withdrawal.created_at,
    });
  }
}

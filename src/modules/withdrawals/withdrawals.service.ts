import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Withdrawal } from '@prisma/client';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { SecurityService } from '../../common/security/security.service';
import { PixKeysRepository } from '../../infra/db/repositories/pix-keys.repositories';
import { WalletsRepository } from '../../infra/db/repositories/wallets.repositories';
import { WithdrawalsRepository } from '../../infra/db/repositories/withdrawals.repositories';
import { SafeUser } from '../auth/entities/safe-user.entity';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { ListWithdrawalsQueryDto } from './dto/list-withdrawals-query.dto';
import { WithdrawalEntity } from './entities/withdrawal.entity';

const FEE_PERCENTAGE = 4;
const MIN_WITHDRAWAL_AMOUNT = 1;

@Injectable()
export class WithdrawalsService {
  constructor(
    private withdrawalsRepository: WithdrawalsRepository,
    private walletsRepository: WalletsRepository,
    private pixKeysRepository: PixKeysRepository,
    private securityService: SecurityService,
  ) {}

  async create(
    user: SafeUser,
    dto: CreateWithdrawalDto,
  ): Promise<WithdrawalEntity> {
    if (dto.amount < MIN_WITHDRAWAL_AMOUNT) {
      throw new BadRequestException(
        `Minimum withdrawal amount is R$ ${MIN_WITHDRAWAL_AMOUNT}`,
      );
    }

    const wallet = await this.walletsRepository.findByUserId({
      userId: user.id,
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found.');
    }

    const pix = await this.pixKeysRepository.findById(dto.pixId);

    if (!pix || pix.user_id !== user.id) {
      throw new NotFoundException('Pix key not found.');
    }

    const feeAmount = +(dto.amount * (FEE_PERCENTAGE / 100)).toFixed(2);
    const netAmount = +(dto.amount - feeAmount).toFixed(2);

    const withdrawal = await this.withdrawalsRepository.processWithdrawal({
      userId: user.id,
      pixId: pix.id,
      pixKey: pix.key,
      grossAmount: dto.amount,
      netAmount,
      feeAmount,
    });

    return this.mapToEntity(withdrawal);
  }

  async findAll(
    user: SafeUser,
    query: ListWithdrawalsQueryDto,
  ): Promise<PaginatedResponseDto<WithdrawalEntity>> {
    const result = await this.withdrawalsRepository.findByUserId({
      userId: user.id,
      startDate: query.startDate,
      endDate: query.endDate,
      status: query.status,
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    });

    return new PaginatedResponseDto(
      result.data.map((w) => this.mapToEntity(w)),
      {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    );
  }

  async approve(id: string): Promise<WithdrawalEntity> {
    const withdrawal = await this.withdrawalsRepository.approveWithdrawal(id);
    return this.mapToEntity(withdrawal);
  }

  async reject(id: string): Promise<WithdrawalEntity> {
    const withdrawal = await this.withdrawalsRepository.rejectWithdrawal(id);
    return this.mapToEntity(withdrawal);
  }

  private mapToEntity(withdrawal: Withdrawal): WithdrawalEntity {
    const decryptedPix = this.securityService.decryptData(withdrawal.pix_value);

    return new WithdrawalEntity({
      id: withdrawal.id,
      pixId: withdrawal.pix_id,
      pixValue: decryptedPix,
      amount: Number(withdrawal.gross_amount),
      netAmount: Number(withdrawal.net_amount),
      feeAmount: Number(withdrawal.fee_amount),
      status: withdrawal.status,
      createdAt: withdrawal.created_at,
    });
  }
}

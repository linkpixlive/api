import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Withdrawal } from '@prisma/client';
import { SentPixStatus } from 'src/common/interfaces/sent-pix-status.type';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { SecurityService } from '../../common/security/security.service';
import { PixKeysRepository } from '../../infra/db/repositories/pix-keys.repositories';
import { WalletsRepository } from '../../infra/db/repositories/wallets.repositories';
import { WithdrawalsRepository } from '../../infra/db/repositories/withdrawals.repositories';
import { GatewayContract } from '../../infra/gateway/contract/gateway.contract';
import { SafeUser } from '../auth/entities/safe-user.entity';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { ListWithdrawalsQueryDto } from './dto/list-withdrawals-query.dto';
import { WithdrawalEntity } from './entities/withdrawal.entity';

@Injectable()
export class WithdrawalsService {
  constructor(
    private withdrawalsRepository: WithdrawalsRepository,
    private walletsRepository: WalletsRepository,
    private pixKeysRepository: PixKeysRepository,
    private securityService: SecurityService,
    private configService: ConfigService,
    private gatewayContract: GatewayContract,
  ) {}

  async create(
    user: SafeUser,
    dto: CreateWithdrawalDto,
  ): Promise<WithdrawalEntity> {
    const minAmount = this.configService.getOrThrow<number>(
      'MIN_WITHDRAWAL_AMOUNT',
    );
    if (dto.amount < minAmount) {
      throw new BadRequestException(
        `Minimum withdrawal amount is R$ ${minAmount}`,
      );
    }

    const wallet = await this.walletsRepository.findByUserId({
      userId: user.id,
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found.');
    }

    const pix = await this.pixKeysRepository.findById(dto.pixId);

    if (!pix || pix.userId !== user.id) {
      throw new NotFoundException('Pix key not found.');
    }

    const feePercentage = this.configService.getOrThrow<number>(
      'WITHDRAWAL_FEE_PERCENTAGE',
    );
    const feeAmount = +(dto.amount * (feePercentage / 100)).toFixed(2);
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
    const withdrawal = await this.withdrawalsRepository.findById(id);

    const pixKey = this.securityService.decryptData(withdrawal.pixValue);
    const withdrawalId = withdrawal.id.replace(/-/g, '');

    const pixDestination =
      this.configService.get('NODE_ENV') === 'development'
        ? 'efipay@sejaefi.com.br'
        : pixKey;

    const result = await this.gatewayContract.sendPix({
      idempotencyId: withdrawalId,
      amount: Number(withdrawal.netAmount),
      pixDestination,
    });

    const updated = await this.withdrawalsRepository.processingWithdrawal(
      id,
      result.transactionId,
    );

    return this.mapToEntity(updated);
  }

  async reject(id: string): Promise<WithdrawalEntity> {
    const withdrawal = await this.withdrawalsRepository.rejectWithdrawal(id);
    return this.mapToEntity(withdrawal);
  }

  async handleWebhookPixSend(id: string): Promise<void> {
    const uuid = `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;

    const result = await this.gatewayContract.getSentPixStatus(id);

    if (result.status === SentPixStatus.SUCCESS) {
      await this.withdrawalsRepository.approveWithdrawal(
        uuid,
        result.transactionId,
      );
    } else if (result.status === SentPixStatus.FAILED) {
      await this.withdrawalsRepository.rejectWithdrawal(uuid);
    }
  }

  private mapToEntity(withdrawal: Withdrawal): WithdrawalEntity {
    const decryptedPix = this.securityService.decryptData(withdrawal.pixValue);

    return new WithdrawalEntity({
      id: withdrawal.id,
      pixId: withdrawal.pixId,
      pixValue: decryptedPix,
      amount: Number(withdrawal.grossAmount),
      netAmount: Number(withdrawal.netAmount),
      feeAmount: Number(withdrawal.feeAmount),
      status: withdrawal.status,
    });
  }
}

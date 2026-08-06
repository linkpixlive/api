import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Withdrawal, WithdrawalStatus } from '@prisma/client';
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
    clientKey?: string,
  ): Promise<WithdrawalEntity> {
    if (clientKey) {
      const existing = await this.withdrawalsRepository.findByClientKey(
        user.id,
        clientKey,
      );

      if (existing) {
        return this.mapToEntity(existing);
      }
    }

    const minAmount = this.configService.getOrThrow<number>(
      'MIN_WITHDRAWAL_AMOUNT',
    );
    if (dto.amount < minAmount) {
      throw new BadRequestException(
        `Valor mínimo para saque é R$ ${minAmount}`,
      );
    }

    const wallet = await this.walletsRepository.findByUserId({
      userId: user.id,
    });

    if (!wallet) {
      throw new NotFoundException('Carteira não encontrada.');
    }

    const pix = await this.pixKeysRepository.findById(dto.pixId);

    if (!pix || pix.userId !== user.id) {
      throw new NotFoundException('Chave Pix não encontrada.');
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
      keyMasked: pix.keyMasked,
      clientKey: clientKey ?? null,
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
    // Atomically transition pending → processing FIRST. If another concurrent
    // request already won this race, processingWithdrawal throws BadRequestException.
    const transition = await this.withdrawalsRepository.processingWithdrawal(
      id,
      undefined,
    );

    const pixKey = this.securityService.decryptData(transition.pixValue);
    const idempotencyId = transition.id.replace(/-/g, '');

    const pixDestination =
      this.configService.get('NODE_ENV') === 'development'
        ? 'efipay@sejaefi.com.br'
        : pixKey;

    try {
      const result = await this.gatewayContract.sendPix({
        idempotencyId,
        amount: Number(transition.netAmount),
        pixDestination,
      });

      const updated = await this.withdrawalsRepository.approveWithdrawal(
        id,
        result.transactionId,
      );

      return this.mapToEntity(updated);
    } catch (error) {
      // Gateway call failed — compensate by refunding balance and marking failed
      await this.withdrawalsRepository.rejectWithdrawal(id);
      throw error;
    }
  }

  async reject(id: string): Promise<WithdrawalEntity> {
    const withdrawal = await this.withdrawalsRepository.rejectWithdrawal(id);
    return this.mapToEntity(withdrawal);
  }

  async handleWebhookPixSend(id: string): Promise<void> {
    const uuid = `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;

    // 1. Existence check
    const withdrawal = await this.withdrawalsRepository.findById(uuid);

    // 2. State check — ignore webhooks for already-decided withdrawals
    if (
      withdrawal.status !== WithdrawalStatus.pending &&
      withdrawal.status !== WithdrawalStatus.processing
    ) {
      return;
    }

    // 3. Authoritative status from gateway
    const gatewayResult = await this.gatewayContract.getSentPixStatus(id);

    // 4. Defensive consistency — only proceed if transactionIds don't conflict
    if (
      withdrawal.transactionId &&
      gatewayResult.transactionId &&
      withdrawal.transactionId !== gatewayResult.transactionId
    ) {
      return;
    }

    // 5. Mutate based on authoritative status
    if (gatewayResult.status === SentPixStatus.SUCCESS) {
      await this.withdrawalsRepository.approveWithdrawal(
        uuid,
        gatewayResult.transactionId,
      );
    } else if (gatewayResult.status === SentPixStatus.FAILED) {
      await this.withdrawalsRepository.rejectWithdrawal(uuid);
    }
    // PROCESSING — leave it; the scheduler cron will retry on next tick
  }

  private mapToEntity(withdrawal: Withdrawal): WithdrawalEntity {
    return new WithdrawalEntity({
      id: withdrawal.id,
      pixId: withdrawal.pixId,
      keyMasked: withdrawal.keyMasked,
      amount: Number(withdrawal.grossAmount),
      netAmount: Number(withdrawal.netAmount),
      feeAmount: Number(withdrawal.feeAmount),
      status: withdrawal.status,
    });
  }
}

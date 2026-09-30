import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Withdrawal, WithdrawalStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { SentPixStatus } from 'src/common/interfaces/sent-pix-status.type';
import { assertPasswordWithOptionalTotp } from 'src/common/security/step-up.util';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { WithdrawalClientKeyConflictError } from '../../common/errors/withdrawals.errors';
import { decryptData } from '../../common/utils/crypto.util';
import { PixKeysRepository } from '../../infra/db/repositories/pix-keys.repositories';
import { UsersRepository } from '../../infra/db/repositories/users.repositories';
import { WalletsRepository } from '../../infra/db/repositories/wallets.repositories';
import { WithdrawalsRepository } from '../../infra/db/repositories/withdrawals.repositories';
import { GatewayContract } from '../../infra/gateway/contract/gateway.contract';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { ListWithdrawalsQueryDto } from './dto/list-withdrawals-query.dto';
import { WithdrawalEntity } from './entities/withdrawal.entity';

@Injectable()
export class WithdrawalsService {
  constructor(
    private withdrawalsRepository: WithdrawalsRepository,
    private walletsRepository: WalletsRepository,
    private pixKeysRepository: PixKeysRepository,
    private usersRepository: UsersRepository,
    private configService: ConfigService,
    private gatewayContract: GatewayContract,
  ) {}

  async create(
    user: AuthenticatedUser,
    dto: CreateWithdrawalDto,
    clientKey: string,
  ): Promise<WithdrawalEntity> {
    const fresh = await this.usersRepository.findById(user.id);
    if (!fresh) throw new UnauthorizedException();
    await assertPasswordWithOptionalTotp(fresh, dto.password, dto.totp);

    const existing = await this.withdrawalsRepository.findByClientKey(
      user.id,
      clientKey,
    );

    if (existing) {
      if (!this.isSameRequest(existing, dto)) {
        throw new WithdrawalClientKeyConflictError();
      }
      return this.mapToEntity(existing);
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
    const grossAmount = new Decimal(dto.amount);
    const feeAmount = grossAmount
      .times(feePercentage)
      .div(100)
      .toDecimalPlaces(2);
    const netAmount = grossAmount.minus(feeAmount).toDecimalPlaces(2);

    let withdrawal: Withdrawal;
    try {
      withdrawal = await this.withdrawalsRepository.processWithdrawal({
        userId: user.id,
        pixId: pix.id,
        pixKey: pix.key,
        keyMasked: pix.keyMasked,
        clientKey,
        grossAmount: dto.amount,
        netAmount,
        feeAmount,
      });
    } catch (error) {
      if (error instanceof WithdrawalClientKeyConflictError) {
        const existing = await this.withdrawalsRepository.findByClientKey(
          user.id,
          clientKey,
        );
        if (existing && this.isSameRequest(existing, dto)) {
          return this.mapToEntity(existing);
        }
      }
      throw error;
    }

    return this.mapToEntity(withdrawal, pix.keyType);
  }

  async findAll(
    user: AuthenticatedUser,
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

  async handleWebhookPixSend(id: string): Promise<void> {
    if (!/^[0-9a-f]{32}$/i.test(id)) {
      return;
    }

    const uuid = `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;

    const withdrawal = await this.withdrawalsRepository.findById(uuid);

    if (!withdrawal) {
      return;
    }

    if (
      withdrawal.status !== WithdrawalStatus.pending &&
      withdrawal.status !== WithdrawalStatus.processing
    ) {
      return;
    }

    const gatewayResult = await this.gatewayContract.getSentPixStatus(id);

    if (
      withdrawal.transactionId &&
      gatewayResult.transactionId &&
      withdrawal.transactionId !== gatewayResult.transactionId
    ) {
      return;
    }

    if (gatewayResult.status === SentPixStatus.SUCCESS) {
      await this.withdrawalsRepository.approveWithdrawal(
        uuid,
        gatewayResult.transactionId,
      );
    } else if (gatewayResult.status === SentPixStatus.FAILED) {
      if (withdrawal.status === WithdrawalStatus.processing) {
        await this.withdrawalsRepository.failProcessingWithdrawal(
          uuid,
          gatewayResult.transactionId,
        );
      } else {
        await this.withdrawalsRepository.rejectWithdrawal(
          uuid,
          gatewayResult.transactionId,
        );
      }
    }
  }

  private isSameRequest(
    existing: { grossAmount: Decimal; pixId: string | null },
    dto: CreateWithdrawalDto,
  ): boolean {
    return (
      existing.pixId === dto.pixId &&
      new Decimal(dto.amount).equals(existing.grossAmount)
    );
  }

  private mapToEntity(
    withdrawal: Withdrawal & { pixKey?: { keyType: string } | null },
    keyTypeOverride?: string,
  ): WithdrawalEntity {
    return new WithdrawalEntity({
      id: withdrawal.id,
      pixId: withdrawal.pixId,
      key: this.decryptPixValue(withdrawal.pixValue),
      keyType: keyTypeOverride ?? withdrawal.pixKey?.keyType,
      keyMasked: withdrawal.keyMasked,
      amount: Number(withdrawal.grossAmount),
      netAmount: Number(withdrawal.netAmount),
      feeAmount: Number(withdrawal.feeAmount),
      status: withdrawal.status,
      createdAt: withdrawal.createdAt,
    });
  }

  private decryptPixValue(
    pixValue: string | null | undefined,
  ): string | undefined {
    if (!pixValue) return undefined;
    try {
      return decryptData(pixValue);
    } catch {
      return pixValue;
    }
  }
}

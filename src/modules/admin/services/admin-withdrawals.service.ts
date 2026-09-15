import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Withdrawal } from '@prisma/client';
import { SentPixStatus } from 'src/common/interfaces/sent-pix-status.type';
import { decryptData } from 'src/common/utils/crypto.util';
import { WithdrawalsRepository } from 'src/infra/db/repositories/withdrawals.repositories';
import { GatewayContract } from 'src/infra/gateway/contract/gateway.contract';
import { WithdrawalEntity } from 'src/modules/withdrawals/entities/withdrawal.entity';

@Injectable()
export class AdminWithdrawalsService {
  private readonly logger = new Logger(AdminWithdrawalsService.name);

  constructor(
    private withdrawalsRepository: WithdrawalsRepository,
    private configService: ConfigService,
    private gatewayContract: GatewayContract,
  ) {}

  async approve(id: string): Promise<WithdrawalEntity> {
    const transition = await this.withdrawalsRepository.processingWithdrawal(
      id,
      undefined,
    );

    const pixKey = decryptData(transition.pixValue);
    const idempotencyId = transition.id.replace(/-/g, '');

    const pixDestination =
      this.configService.get<string>('PIX_REDIRECT_DESTINATION') ?? pixKey;

    let result: { status: SentPixStatus; transactionId?: string };
    try {
      result = await this.gatewayContract.sendPix({
        idempotencyId,
        amount: Number(transition.netAmount),
        pixDestination,
      });
    } catch (error) {
      this.logger.error(
        `sendPix falhou para o saque ${id}; aguardando conciliação do gateway`,
        error instanceof Error ? error.stack : String(error),
      );
      return this.mapToEntity(transition);
    }

    if (result.status === SentPixStatus.SUCCESS) {
      const updated = await this.withdrawalsRepository.approveWithdrawal(
        id,
        result.transactionId,
      );
      return this.mapToEntity(updated);
    }

    if (result.status === SentPixStatus.FAILED) {
      const updated = await this.withdrawalsRepository.failProcessingWithdrawal(
        id,
        result.transactionId,
      );
      return this.mapToEntity(updated);
    }

    return this.mapToEntity(transition);
  }

  async reject(id: string): Promise<WithdrawalEntity> {
    const withdrawal = await this.withdrawalsRepository.rejectWithdrawal(id);
    return this.mapToEntity(withdrawal);
  }

  private mapToEntity(
    withdrawal: Withdrawal & { pixKey?: { keyType: string } | null },
  ): WithdrawalEntity {
    return new WithdrawalEntity({
      id: withdrawal.id,
      pixId: withdrawal.pixId,
      key: this.decryptPixValue(withdrawal.pixValue),
      keyType: withdrawal.pixKey?.keyType,
      keyMasked: withdrawal.keyMasked,
      amount: Number(withdrawal.grossAmount),
      netAmount: Number(withdrawal.netAmount),
      feeAmount: Number(withdrawal.feeAmount),
      status: withdrawal.status,
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

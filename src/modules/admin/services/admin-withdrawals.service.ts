import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Withdrawal } from '@prisma/client';
import { SecurityService } from 'src/common/security/security.service';
import { WithdrawalsRepository } from 'src/infra/db/repositories/withdrawals.repositories';
import { GatewayContract } from 'src/infra/gateway/contract/gateway.contract';
import { WithdrawalEntity } from 'src/modules/withdrawals/entities/withdrawal.entity';

@Injectable()
export class AdminWithdrawalsService {
  constructor(
    private withdrawalsRepository: WithdrawalsRepository,
    private securityService: SecurityService,
    private configService: ConfigService,
    private gatewayContract: GatewayContract,
  ) {}

  async approve(id: string): Promise<WithdrawalEntity> {
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
      await this.withdrawalsRepository.rejectWithdrawal(id);
      throw error;
    }
  }

  async reject(id: string): Promise<WithdrawalEntity> {
    const withdrawal = await this.withdrawalsRepository.rejectWithdrawal(id);
    return this.mapToEntity(withdrawal);
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

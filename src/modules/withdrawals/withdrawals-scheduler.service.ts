import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SentPixStatus } from 'src/common/interfaces/sent-pix-status.type';
import { WithdrawalsRepository } from 'src/infra/db/repositories/withdrawals.repositories';
import { GatewayContract } from 'src/infra/gateway/contract/gateway.contract';

@Injectable()
export class WithdrawalsSchedulerService {
  private readonly logger = new Logger(WithdrawalsSchedulerService.name);

  constructor(
    private readonly withdrawalsRepository: WithdrawalsRepository,
    private readonly gatewayContract: GatewayContract,
  ) {}

  @Cron('*/5 * * * *')
  async handleProcessingWithdrawals() {
    const withdrawals =
      await this.withdrawalsRepository.findProcessingWithdrawals();

    for (const withdrawal of withdrawals) {
      try {
        const idempotencyId = withdrawal.id.replace(/-/g, '');

        const result =
          await this.gatewayContract.getSentPixStatus(idempotencyId);

        if (result.status === SentPixStatus.SUCCESS) {
          await this.withdrawalsRepository.approveWithdrawal(
            withdrawal.id,
            result.transactionId,
          );
          this.logger.log(
            `Saque ${withdrawal.id} aprovado via agendador.`,
          );
        } else if (result.status === SentPixStatus.FAILED) {
          await this.withdrawalsRepository.rejectWithdrawal(withdrawal.id);
          this.logger.log(
            `Saque ${withdrawal.id} rejeitado via agendador.`,
          );
        }
      } catch {
        this.logger.error(`Falha ao resolver saque ${withdrawal.id}`);
      }
    }
  }
}

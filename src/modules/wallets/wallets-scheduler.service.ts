import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WalletsRepository } from '../../infra/db/repositories/wallets.repositories';

@Injectable()
export class WalletsSchedulerService {
  private readonly logger = new Logger(WalletsSchedulerService.name);

  constructor(private readonly walletsRepository: WalletsRepository) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async reconcileAllWallets() {
    this.logger.log('Starting wallet reconciliation...');

    const batchSize = 100;
    let skip = 0;
    let checked = 0;
    let mismatches = 0;

    while (true) {
      const userIds = await this.walletsRepository.findManyUserIds(
        skip,
        batchSize,
      );
      if (userIds.length === 0) break;

      for (const userId of userIds) {
        try {
          const result = await this.walletsRepository.reconcile(userId);
          checked++;

          if (!result.match) {
            mismatches++;
            this.logger.error(
              `Balance drift for user ${userId}: ` +
                `wallet=${result.walletBalance.toString()} ledger=${result.ledgerBalance.toString()} ` +
                `chainValid=${result.chainValid}`,
            );
          }
        } catch (error) {
          mismatches++;
          this.logger.error(
            `Reconciliation failed for user ${userId}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }

      if (userIds.length < batchSize) break;
      skip += batchSize;
    }

    this.logger.log(
      `Wallet reconciliation done: ${checked} checked, ${mismatches} mismatches.`,
    );
  }
}

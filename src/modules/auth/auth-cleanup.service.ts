import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UsersRepository } from 'src/infra/db/repositories/users.repositories';

@Injectable()
export class AuthCleanupService {
  private readonly logger = new Logger(AuthCleanupService.name);

  constructor(private readonly usersRepository: UsersRepository) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleCleanup() {
    this.logger.debug('Executando limpeza de usuários não verificados...');

    const fifteenMinutesAgo = new Date();
    fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);

    try {
      const result =
        await this.usersRepository.deleteManyUnverified(fifteenMinutesAgo);

      if (result.count > 0) {
        this.logger.log(`Limpou ${result.count} usuários não verificados.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Falha ao limpar usuários não verificados: ${message}`);
    }
  }
}

import { DomainError } from './domain.error';

export class WalletNotFoundError extends DomainError {
  constructor() {
    super('Carteira não encontrada.', 404);
  }
}

export class InsufficientBalanceError extends DomainError {
  constructor() {
    super('Saldo insuficiente.', 400);
  }
}

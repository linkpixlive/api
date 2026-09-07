import { DomainError } from './domain.error';

export class WithdrawalClientKeyConflictError extends DomainError {
  constructor() {
    super('Withdrawal request already exists.', 409);
  }
}

export class WithdrawalNotFoundError extends DomainError {
  constructor() {
    super('Withdrawal not found.', 404);
  }
}

export class WithdrawalInvalidStatusError extends DomainError {
  constructor(message: string) {
    super(message, 400);
  }
}

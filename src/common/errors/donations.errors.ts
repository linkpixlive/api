import { DomainError } from './domain.error';

export class DonationNotFoundError extends DomainError {
  constructor() {
    super('Doação não encontrada.', 404);
  }
}

export class DonationAlreadyProcessedError extends DomainError {
  constructor() {
    super('Doação já processada.', 409);
  }
}

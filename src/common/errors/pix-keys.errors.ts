import { DomainError } from './domain.error';

export class PixKeyLimitReachedError extends DomainError {
  constructor(maxKeys: number) {
    super(`Você pode registrar até ${maxKeys} chaves Pix.`, 400);
  }
}

export class PixKeyAlreadyExistsError extends DomainError {
  constructor() {
    super('Esta chave Pix já está registrada.', 409);
  }
}

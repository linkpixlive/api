export interface CreatePixKeyParams {
  userId: string;
  key: string;
  keyType: 'cpf' | 'email' | 'phone' | 'random';
  alias?: string;
}

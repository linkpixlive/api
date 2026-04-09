export interface CreatePixKeyParams {
  userId: string;
  key: string;
  keyType: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  alias?: string;
}

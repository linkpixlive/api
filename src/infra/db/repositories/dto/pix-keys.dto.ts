export interface CreatePixKeyParams {
  userId: string;
  key: string;
  keyHashed: string;
  keyMasked: string;
  keyType: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  alias?: string;
}

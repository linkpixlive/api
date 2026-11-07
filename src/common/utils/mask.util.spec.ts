import { maskPixKey } from './mask.util';

describe('maskPixKey', () => {
  it('mascara CPF mantendo só os 2 últimos dígitos visíveis', () => {
    expect(maskPixKey('cpf', '123.456.789-01')).toBe('***.***.***-01');
  });

  it('mascara CPF sem formatação', () => {
    expect(maskPixKey('cpf', '12345678901')).toBe('***.***.***-01');
  });

  it('retorna CPF intacto quando não tem 11 dígitos', () => {
    expect(maskPixKey('cpf', '1234567890')).toBe('1234567890');
  });

  it('mascara CNPJ mantendo só os 2 últimos dígitos visíveis', () => {
    expect(maskPixKey('cnpj', '12.345.678/0001-95')).toBe('**.***.***/****-95');
  });

  it('retorna CNPJ intacto quando não tem 14 dígitos', () => {
    expect(maskPixKey('cnpj', '123456780001')).toBe('123456780001');
  });

  it('mascara telefone com DDI (+55) usando os últimos 11 dígitos', () => {
    expect(maskPixKey('phone', '+5511999998888')).toBe('(11) 9****-8888');
  });

  it('mascara telefone sem DDI', () => {
    expect(maskPixKey('phone', '11999998888')).toBe('(11) 9****-8888');
  });

  it('retorna telefone intacto quando tem menos de 11 dígitos', () => {
    expect(maskPixKey('phone', '999998888')).toBe('999998888');
  });

  it('mascara email exibindo no máximo 2 caracteres do usuário', () => {
    expect(maskPixKey('email', 'joao@example.com')).toBe('jo***@example.com');
    expect(maskPixKey('email', 'a@example.com')).toBe('a***@example.com');
  });

  it('retorna email intacto quando não tem domínio', () => {
    expect(maskPixKey('email', 'sem-arroba')).toBe('sem-arroba');
  });

  it('mascara chave aleatória exibindo início e fim quando longa', () => {
    expect(maskPixKey('random', '123e4567-e89b-12d3-a456-426614174000')).toBe(
      '123e***4000',
    );
  });

  it('mascara chave aleatória curta inteiramente', () => {
    expect(maskPixKey('random', 'abc')).toBe('***');
  });

  it('retorna a key intacta para tipo desconhecido', () => {
    expect(maskPixKey('unknown', 'qualquer-valor')).toBe('qualquer-valor');
  });
});

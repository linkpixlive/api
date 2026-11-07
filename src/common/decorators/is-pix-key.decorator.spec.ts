import { IsPixKeyConstraint } from './is-pix-key.decorator';

describe('IsPixKeyConstraint', () => {
  const validator = new IsPixKeyConstraint();

  describe('validate', () => {
    it('aceita CPF válido (com ou sem formatação)', () => {
      expect(validator.validate('529.982.247-25')).toBe(true);
      expect(validator.validate('52998224725')).toBe(true);
    });

    it('rejeita CPF com dígitos verificadores inválidos', () => {
      expect(validator.validate('529.982.247-26')).toBe(false);
      expect(validator.validate('111.111.111-11')).toBe(false);
    });

    it('aceita CNPJ válido', () => {
      expect(validator.validate('11.444.777/0001-61')).toBe(true);
      expect(validator.validate('11444777000161')).toBe(true);
    });

    it('rejeita CNPJ inválido', () => {
      expect(validator.validate('11.444.777/0001-62')).toBe(false);
    });

    it('aceita telefone com 10 a 15 dígitos, com ou sem DDI', () => {
      expect(validator.validate('+5511999998888')).toBe(true);
      expect(validator.validate('11999998888')).toBe(true);
      expect(validator.validate('1199998888')).toBe(true); // 10 dígitos
    });

    it('rejeita telefone com menos de 10 ou mais de 15 dígitos', () => {
      expect(validator.validate('9998888')).toBe(false);
      expect(validator.validate('+5511999999999999999')).toBe(false);
    });

    it('aceita email válido', () => {
      expect(validator.validate('joao@example.com')).toBe(true);
    });

    it('rejeita email malformado', () => {
      expect(validator.validate('sem-arroba')).toBe(false);
      expect(validator.validate('a@b')).toBe(false);
    });

    it('aceita chave aleatória (UUID)', () => {
      expect(validator.validate('123e4567-e89b-12d3-a456-426614174000')).toBe(
        true,
      );
    });

    it('rejeita string arbitrária', () => {
      expect(validator.validate('texto-qualquer')).toBe(false);
    });

    it('rejeita valor ausente ou não-string', () => {
      expect(validator.validate('')).toBe(false);
      expect(validator.validate(undefined as unknown as string)).toBe(false);
      expect(validator.validate(123 as unknown as string)).toBe(false);
    });
  });

  describe('defaultMessage', () => {
    it('explica os formatos aceitos', () => {
      expect(validator.defaultMessage()).toContain('CPF');
      expect(validator.defaultMessage()).toContain('random');
    });
  });
});

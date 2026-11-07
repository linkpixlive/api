import { InternalServerErrorException } from '@nestjs/common';
import { decryptData, encryptData, hashData } from './crypto.util';

describe('crypto.util', () => {
  const ORIGINAL_KEY = process.env.ENCRYPTION_KEY;

  afterEach(() => {
    process.env.ENCRYPTION_KEY = ORIGINAL_KEY;
  });

  describe('encryptData / decryptData', () => {
    it('faz round-trip de texto simples', () => {
      const text = 'mensagem de teste';
      const cipher = encryptData(text);

      expect(decryptData(cipher)).toBe(text);
    });

    it('faz round-trip de texto com acentos e caracteres especiais', () => {
      const text = 'Chave pix: joão@example.com — r$ 100,00!';
      const cipher = encryptData(text);

      expect(decryptData(cipher)).toBe(text);
    });

    it('produz ciphertexts diferentes para o mesmo texto (IV aleatório)', () => {
      const text = 'mesmo texto';
      expect(encryptData(text)).not.toBe(encryptData(text));
    });

    it('lança quando o ciphertext foi adulterado', () => {
      const text = 'integridade';
      const cipher = encryptData(text);
      const bytes = Buffer.from(cipher, 'base64');
      bytes[bytes.length - 1] ^= 0xff; // altera o último byte do texto cifrado

      expect(() => decryptData(bytes.toString('base64'))).toThrow();
    });

    it('lança quando o ciphertext é truncado', () => {
      const text = 'integridade';
      const cipher = encryptData(text);
      const bytes = Buffer.from(cipher, 'base64');

      expect(() =>
        decryptData(bytes.subarray(0, 10).toString('base64')),
      ).toThrow();
    });
  });

  describe('hashData', () => {
    it('é determinístico para o mesmo valor', () => {
      expect(hashData('valor')).toBe(hashData('valor'));
    });

    it('produz hashes diferentes para valores diferentes', () => {
      expect(hashData('valor')).not.toBe(hashData('outro'));
    });

    it('retorna 64 caracteres hexadecimais (sha256)', () => {
      expect(hashData('valor')).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('validação de ENCRYPTION_KEY', () => {
    it('lança InternalServerErrorException quando a variável está ausente', () => {
      delete process.env.ENCRYPTION_KEY;

      expect(() => encryptData('x')).toThrow(InternalServerErrorException);
      expect(() => decryptData('x')).toThrow(InternalServerErrorException);
      expect(() => hashData('x')).toThrow(InternalServerErrorException);
    });

    it('lança quando a chave não tem 64 caracteres hexadecimais', () => {
      process.env.ENCRYPTION_KEY = 'chave-invalida';

      expect(() => encryptData('x')).toThrow(InternalServerErrorException);
    });
  });
});

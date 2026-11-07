import { extractCustomWords, findBlockedCustomWord } from './custom-rules.util';

describe('extractCustomWords', () => {
  it('separa palavras por quebra de linha, vírgula e ponto-e-vírgula', () => {
    expect(extractCustomWords('primeira\nsegunda,terceira;quarta')).toEqual([
      'primeira',
      'segunda',
      'terceira',
      'quarta',
    ]);
  });

  it('remove espaços das entradas', () => {
    expect(extractCustomWords('  palavra  ,  outra  ')).toEqual([
      'palavra',
      'outra',
    ]);
  });

  it('descarta entradas com espaços internos (frases)', () => {
    expect(extractCustomWords('duas palavras\nvalida')).toEqual(['valida']);
  });

  it('descarta entradas com menos de 2 caracteres', () => {
    expect(extractCustomWords('a\nok')).toEqual(['ok']);
  });
});

describe('findBlockedCustomWord', () => {
  it('bloqueia correspondência exata no nome', () => {
    expect(findBlockedCustomWord('João', null, 'joao')).toBe('joao');
  });

  it('bloqueia correspondência na mensagem', () => {
    expect(findBlockedCustomWord('Ana', 'que isso amigo', 'amigo')).toBe(
      'amigo',
    );
  });

  it('normaliza acentos dos dois lados', () => {
    expect(findBlockedCustomWord('Inácio', null, 'inacio')).toBe('inacio');
  });

  it('normaliza leet (0→o, 4→a)', () => {
    expect(findBlockedCustomWord('Ana', 'que p0rr4', 'porra')).toBe('porra');
  });

  it('colapsa letras repetidas dos dois lados', () => {
    expect(findBlockedCustomWord('Ana', 'que porrrra', 'porra')).toBe('porra');
  });

  it('não bloqueia palavra curta dentro de outra (fronteira)', () => {
    expect(findBlockedCustomWord('Ana', 'eu custo isso', 'cu')).toBeNull();
  });

  it('bloqueia palavra curta quando é o texto inteiro', () => {
    expect(findBlockedCustomWord('Ana', 'cu', 'cu')).toBe('cu');
  });

  it('bloqueia palavra longa mesclada com separadores (ca-ralho)', () => {
    expect(findBlockedCustomWord('Ana', 'que ca-ralho', 'caralho')).toBe(
      'caralho',
    );
  });

  it('bloqueia palavra longa mesclada com espaços (c a r a l h o)', () => {
    expect(findBlockedCustomWord('Ana', 'c a r a l h o', 'caralho')).toBe(
      'caralho',
    );
  });

  it('não aplica mesclagem a palavras curtas', () => {
    expect(findBlockedCustomWord('Ana', 'c-u', 'cu')).toBeNull();
  });

  it('ignora campo vazio e mensagem nula', () => {
    expect(findBlockedCustomWord('', null, 'palavra')).toBeNull();
  });

  it('retorna null quando não há regras', () => {
    expect(findBlockedCustomWord('João', 'mensagem', '')).toBeNull();
  });
});

import { sanitizeSpamText } from './spam-sanitizer.util';

describe('sanitizeSpamText', () => {
  it('colapsa runs de caracteres acima do limite', () => {
    expect(sanitizeSpamText('kkkkkkkkkkkk')).toBe('kkkkk');
  });

  it('colapsa fragmentos repetidos 3+ vezes', () => {
    expect(sanitizeSpamText('buabuabua')).toBe('buabua');
    expect(sanitizeSpamText('pspspsps')).toBe('psps');
  });

  it('mantém repetição dupla (não é spam suficiente)', () => {
    expect(sanitizeSpamText('haha')).toBe('haha');
  });

  it('repete colapsos quando surgem padrões aninhados', () => {
    // 'buabuabuabuabua' → 'buabuabua' → 'buabua'
    expect(sanitizeSpamText('buabuabuabuabua')).toBe('buabua');
  });

  it('trunca mash de teclado (bigramas repetidos demais)', () => {
    expect(sanitizeSpamText('asdjoasdjokasodkaokdokaosd')).toBe('asdjoasdjoka');
  });

  it('não trunca palavra real longa', () => {
    expect(sanitizeSpamText('internacionalizacoes')).toBe(
      'internacionalizacoes',
    );
  });

  it('não altera texto normal', () => {
    expect(sanitizeSpamText('olá, tudo bem com vocês?')).toBe(
      'olá, tudo bem com vocês?',
    );
  });

  it('colapsa espaços múltiplos após os cortes', () => {
    expect(sanitizeSpamText('buabuabua   foo')).toBe('buabua foo');
  });

  it('retorna texto vazio sem alteração', () => {
    expect(sanitizeSpamText('')).toBe('');
  });
});

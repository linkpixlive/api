import {
  buildModerationPrompt,
  parseModerationVerdict,
} from './moderation-policy';

const baseInput = {
  name: '  João  ',
  message: '  olá pessoal  ',
  rules: {
    filterProfanity: true,
    filterHateSpeech: true,
    customRules: 'palavra1\npalavra2',
  },
};

describe('buildModerationPrompt', () => {
  it('inclui os três filtros quando todos estão ativos', () => {
    const prompt = buildModerationPrompt(baseInput);

    expect(prompt).toContain('- profanity:');
    expect(prompt).toContain('- hate_speech:');
    expect(prompt).toContain('- custom_rule:');
  });

  it('indica nenhum filtro quando todos estão desativados', () => {
    const prompt = buildModerationPrompt({
      ...baseInput,
      rules: {
        filterProfanity: false,
        filterHateSpeech: false,
        customRules: '',
      },
    });

    expect(prompt).toContain('(nenhum — não bloqueie)');
    expect(prompt).toContain('(nenhuma)');
    expect(prompt).not.toContain('- profanity:');
  });

  it('inclui somente os filtros ativos', () => {
    const prompt = buildModerationPrompt({
      ...baseInput,
      rules: {
        filterProfanity: true,
        filterHateSpeech: false,
        customRules: '',
      },
    });

    expect(prompt).toContain('- profanity:');
    expect(prompt).not.toContain('- hate_speech:');
  });

  it('inclui nome e mensagem aparados', () => {
    const prompt = buildModerationPrompt(baseInput);

    expect(prompt).toContain('Nome do doador: João');
    expect(prompt).toContain('Mensagem: olá pessoal');
  });

  it('trata nome e mensagem vazios', () => {
    const prompt = buildModerationPrompt({
      ...baseInput,
      name: '',
      message: '',
    });

    expect(prompt).toContain('Nome do doador: (vazio)');
    expect(prompt).toContain('Mensagem: (vazia)');
  });

  it('inclui as regras customizadas literais no prompt', () => {
    const prompt = buildModerationPrompt(baseInput);

    expect(prompt).toContain('palavra1\npalavra2');
  });
});

describe('parseModerationVerdict', () => {
  it('retorna permitido quando a resposta é vazia/ausente', () => {
    expect(parseModerationVerdict(undefined)).toEqual({
      blocked: false,
      categories: [],
    });
    expect(parseModerationVerdict('')).toEqual({
      blocked: false,
      categories: [],
    });
  });

  it('interpreta bloqueio com categoria válida', () => {
    expect(
      parseModerationVerdict('{"blocked": true, "categories": ["profanity"]}'),
    ).toEqual({ blocked: true, categories: ['profanity'] });
  });

  it('filtra categorias fora da whitelist', () => {
    expect(
      parseModerationVerdict(
        '{"blocked": true, "categories": ["profanity", "violence", 42]}',
      ),
    ).toEqual({ blocked: true, categories: ['profanity'] });
  });

  it('trata blocked não-booleano como permitido', () => {
    expect(
      parseModerationVerdict('{"blocked": "true", "categories": []}'),
    ).toEqual({ blocked: false, categories: [] });
  });

  it('trata categories não-array como lista vazia', () => {
    expect(
      parseModerationVerdict('{"blocked": true, "categories": "profanity"}'),
    ).toEqual({ blocked: true, categories: [] });
  });

  it('fail-open em JSON inválido', () => {
    expect(parseModerationVerdict('isso não é json')).toEqual({
      blocked: false,
      categories: [],
    });
  });
});

const MAX_CHAR_RUN = 5;
const MAX_TOKEN_REPS = 2;
const COLLAPSE_PASSES = 5;
const MASH_MIN_LENGTH = 20;
const MASH_MAX_LENGTH = 12;
const MASH_DUPLICATE_BIGRAM_RATIO = 0.3;

// Runs do mesmo caractere acima do limite (kkkkkkkkk → kkkkk; emoji em cadeia idem).
const CHAR_RUN_PATTERN = new RegExp(`(.)\\1{${MAX_CHAR_RUN},}`, 'gu');

// Fragmento de 2–6 caracteres repetido 3+ vezes seguidas (buabuabua, pspspsps,
// "123 123 123") — o grupo pode incluir o espaço, cobrindo repetição espaçada.
const REPEATED_FRAGMENT_PATTERN = /(.{2,6}?)\1{2,}/gu;

// Mash de teclado: token longo sem espaço cujos bigramas se repetem demais
// ("asdjoasdjokasodkaokdokaosd"). Palavra real longa tem bigramas quase únicos.
function isKeyboardMash(token: string): boolean {
  if (token.length < MASH_MIN_LENGTH) {
    return false;
  }

  const bigrams = new Map<string, number>();
  for (let i = 0; i < token.length - 1; i++) {
    const bigram = token.slice(i, i + 2);
    bigrams.set(bigram, (bigrams.get(bigram) ?? 0) + 1);
  }

  const total = token.length - 1;
  const duplicates = total - bigrams.size;

  return duplicates / total >= MASH_DUPLICATE_BIGRAM_RATIO;
}

export function sanitizeSpamText(text: string): string {
  if (!text) {
    return text;
  }

  let result = text.replace(CHAR_RUN_PATTERN, '$1'.repeat(MAX_CHAR_RUN));

  // Colapsos podem revelar novos padrões aninhados — repete até estabilizar.
  for (let i = 0; i < COLLAPSE_PASSES; i++) {
    const collapsed = result.replace(
      REPEATED_FRAGMENT_PATTERN,
      '$1'.repeat(MAX_TOKEN_REPS),
    );

    if (collapsed === result) {
      break;
    }
    result = collapsed;
  }

  result = result
    .split(/(\s+)/)
    .map((part) =>
      isKeyboardMash(part) ? part.slice(0, MASH_MAX_LENGTH) : part,
    )
    .join('');

  return result.replace(/ {2,}/g, ' ').trim();
}

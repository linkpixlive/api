const WORD_MIN_LENGTH = 2;
const WORD_MAX_LENGTH = 60;
const MERGE_MATCH_MIN_LENGTH = 5;

const LEET_MAP: Record<string, string> = {
  '@': 'a',
  '4': 'a',
  '3': 'e',
  '1': 'i',
  '!': 'i',
  '0': 'o',
  '5': 's',
  $: 's',
  '7': 't',
};

function normalizeForMatch(text: string): string {
  const unaccented = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Leet e runs da mesma letra viram a forma canônica ("p0rr4" e "porrra" →
  // "porra"); separadores viram fronteira canônica (mantém "cu" fora de "custo").
  return unaccented
    .replace(/[@431!05$7]/g, (char) => LEET_MAP[char] ?? char)
    .replace(/(.)\1+/g, '$1')
    .replace(/[^a-z0-9]+/g, '·')
    .replace(/^·+|·+$/g, '');
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function boundaryMatch(haystack: string, needle: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(needle)}([^a-z0-9]|$)`).test(
    haystack,
  );
}

export function extractCustomWords(customRules: string): string[] {
  return customRules
    .split(/[\n,;]+/)
    .map((entry) => entry.trim())
    .filter(
      (entry) =>
        !/\s/.test(entry) &&
        entry.length >= WORD_MIN_LENGTH &&
        entry.length <= WORD_MAX_LENGTH,
    );
}

export function findBlockedCustomWord(
  name: string,
  message: string | null,
  customRules: string,
): string | null {
  const words = extractCustomWords(customRules);

  if (words.length === 0) {
    return null;
  }

  const normalizedWords = words
    .map((word) => ({ word, normalized: normalizeForMatch(word) }))
    .filter(({ normalized }) => normalized.length > 0);

  for (const field of [name, message ?? '']) {
    if (!field.trim()) {
      continue;
    }

    const normalized = normalizeForMatch(field);
    const compact = normalized.replace(/·/g, '');

    for (const { word, normalized: normalizedWord } of normalizedWords) {
      if (boundaryMatch(normalized, normalizedWord)) {
        return word;
      }

      // Tier 2: mescla separadores dos dois lados ("ca-ralho", "c a r a l h o").
      const mergedWord = normalizedWord.replace(/·/g, '');
      if (
        mergedWord.length >= MERGE_MATCH_MIN_LENGTH &&
        compact.includes(mergedWord)
      ) {
        return word;
      }
    }
  }

  return null;
}

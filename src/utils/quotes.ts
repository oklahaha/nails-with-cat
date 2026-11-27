/**
 * 報價: one price per 參考作品 photo, in the photos' order (報價1 for the
 * first photo, …), kept as Price on the photo's row in the 相片 tab.
 */

export function quoteLabel(index: number): string {
  return `報價${index + 1}`;
}

/**
 * The typed 報價 as saved: null where blank, trailing blanks dropped,
 * undefined when none; 'invalid' if any isn't a whole number.
 */
export function parseQuotes(texts: string[]): (number | null)[] | undefined | 'invalid' {
  const values: (number | null)[] = [];
  for (const raw of texts) {
    const text = raw.trim();
    if (text && !/^\d+$/.test(text)) return 'invalid';
    values.push(text ? Number(text) : null);
  }
  while (values.length > 0 && values[values.length - 1] == null) values.pop();
  return values.length > 0 ? values : undefined;
}

/**
 * 報價 by photo position, as on a booking, with `byPath` (only the changed
 * ones; null clears) applied: trailing blanks dropped, undefined when none.
 */
export function withQuotes(
  paths: string[],
  quotes: (number | null)[] | undefined,
  byPath: Record<string, number | null>
): (number | null)[] | undefined {
  const next = paths.map((path, i) => (byPath[path] !== undefined ? byPath[path] : (quotes?.[i] ?? null)));
  while (next.length > 0 && next[next.length - 1] == null) next.pop();
  return next.length > 0 ? next : undefined;
}

/**
 * The 報價 收費 follows: the first one given (non-blank), or undefined if
 * none is, or it isn't a whole number yet. Later ones, valid or not, don't matter.
 */
export function firstQuote(texts: string[]): number | undefined {
  const text = texts.map((t) => t.trim()).find((t) => t !== '');
  return text && /^\d+$/.test(text) ? Number(text) : undefined;
}

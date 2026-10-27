/**
 * `next`, keeping `prev`'s objects wherever their fields are unchanged, and
 * `prev` itself when nothing changed at all. Every Apps Script reload returns
 * fresh objects, so without this each refocus re-renders every row and block
 * even when the sheet is the same.
 */
export function reuseUnchanged<T extends object>(
  prev: T[] | null | undefined,
  next: T[],
  keyOf: (item: T) => string
): T[] {
  if (!prev) return next;
  const byKey = new Map(prev.map((item) => [keyOf(item), item]));
  let same = prev.length === next.length;
  const merged = next.map((item, i) => {
    const old = byKey.get(keyOf(item));
    const kept = old && shallowEqual(old, item) ? old : item;
    if (kept !== prev[i]) same = false;
    return kept;
  });
  return same ? prev : merged;
}

function shallowEqual(a: object, b: object): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every(
    (key) => (a as Record<string, unknown>)[key] === (b as Record<string, unknown>)[key]
  );
}

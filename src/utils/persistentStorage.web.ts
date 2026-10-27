/**
 * Web version of persistentStorage.ts: the browser's localStorage, which
 * avoids expo-sqlite's wasm and cross-origin header setup on web. Private
 * windows or blocked storage can throw, so every access is guarded.
 */
export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignored: e.g. over quota; the data is reloaded from Apps Script anyway
  }
}

/** localStorage writes are synchronous already. */
export const writeStoredNow = writeStored;

export function removeStored(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignored: at worst the old value takes up some space
  }
}

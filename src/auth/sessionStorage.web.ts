/**
 * Web version of sessionStorage.ts: expo-secure-store has no web support, so
 * the browser's localStorage holds the signed-in account instead.
 */
const KEY = 'session-v1';

export function readSession(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeSession(value: string): void {
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    // Ignored: the user stays signed in until the page reloads
  }
}

export function removeSession(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Ignored
  }
}

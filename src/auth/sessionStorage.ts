/**
 * Keeps the signed-in account in the iOS Keychain / Android Keystore
 * (expo-secure-store), read synchronously so the app opens straight to the
 * timetable without a sign-in flash.
 */
import * as SecureStore from 'expo-secure-store';

const KEY = 'session-v1';

export function readSession(): string | null {
  try {
    return SecureStore.getItem(KEY);
  } catch {
    // e.g. the Keychain is locked or the native module is missing: sign in again
    return null;
  }
}

export function writeSession(value: string): void {
  try {
    SecureStore.setItem(KEY, value);
  } catch {
    // Ignored: the user stays signed in until the app restarts
  }
}

export function removeSession(): void {
  SecureStore.deleteItemAsync(KEY).catch(() => {});
}

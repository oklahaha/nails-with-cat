/**
 * Keeps the signed-in account in the iOS Keychain / Android Keystore
 * (expo-secure-store), read synchronously so the app opens straight to the
 * timetable without a sign-in flash.
 */
import * as SecureStore from 'expo-secure-store';

const KEY = 'session-v1';
// Readable after the first unlock since boot: iOS starts the app in the background
// (silent pushes, prewarming) while locked, and WHEN_UNLOCKED reads fail there.
const OPTIONS = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

export function readSession(): string | null {
  try {
    return SecureStore.getItem(KEY, OPTIONS);
  } catch {
    // e.g. the Keychain is locked or the native module is missing: sign in again
    return null;
  }
}

export function writeSession(value: string): void {
  try {
    SecureStore.setItem(KEY, value, OPTIONS);
  } catch {
    // Ignored: the user stays signed in until the app restarts
  }
}

export function removeSession(): void {
  SecureStore.deleteItemAsync(KEY, OPTIONS).catch(() => {});
}

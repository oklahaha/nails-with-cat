/**
 * Small string store that survives app restarts, used to show the last
 * loaded data at once on launch while Apps Script reloads it (iOS / Android;
 * web uses persistentStorage.web.ts).
 *
 * Backed by expo-sqlite's key-value store, whose synchronous reads let
 * screens start with saved data on their first render. Dev builds made
 * before expo-sqlite was added don't include its native module, and
 * importing kv-store would then throw at startup, so it's only required once
 * the module is known to exist; without it nothing is saved.
 */
import { requireOptionalNativeModule } from 'expo';
import type KvStoreType from 'expo-sqlite/kv-store';

const Storage: typeof KvStoreType | null = requireOptionalNativeModule('ExpoSQLite')
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('expo-sqlite/kv-store').default
  : null;

export function readStored(key: string): string | null {
  try {
    return Storage?.getItemSync(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  Storage?.setItem(key, value).catch(() => {
    // Ignored: the data is only a head start, reloaded from Apps Script anyway
  });
}

/**
 * Like writeStored, but done before it returns, for data that must survive
 * the app being closed straight afterwards (the outbox of unsent writes).
 */
export function writeStoredNow(key: string, value: string): void {
  try {
    Storage?.setItemSync(key, value);
  } catch {
    // Ignored: the write still runs this session, only a restart would lose it
  }
}

export function removeStored(key: string): void {
  Storage?.removeItem(key).catch(() => {
    // Ignored: at worst the old value takes up some space
  });
}

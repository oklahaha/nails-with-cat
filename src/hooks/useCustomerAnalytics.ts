import { useFocusEffect } from 'expo-router';
import { useCallback, useSyncExternalStore } from 'react';

import { listCustomerAnalytics } from '@/services/appointmentsApi';
import type { CustomerAnalytics } from '@/types/customerAnalytics';
import { readStored, writeStored } from '@/utils/persistentStorage';

const STORAGE_KEY = 'analytics-cache-v1';

/** The results change once a night, so focusing the tab needn't call Apps Script each time. */
const RELOAD_AFTER_MS = 6 * 60 * 60 * 1000;

let cachedAnalytics: CustomerAnalytics | null = readStoredAnalytics();
/** When this session last loaded, so the first focus after a launch always does. */
let loadedAt = 0;

function readStoredAnalytics(): CustomerAnalytics | null {
  try {
    const parsed: unknown = JSON.parse(readStored(STORAGE_KEY) ?? 'null');
    return parsed && typeof parsed === 'object' ? (parsed as CustomerAnalytics) : null;
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getCachedAnalytics(): CustomerAnalytics | null {
  return cachedAnalytics;
}

async function load(force: boolean): Promise<void> {
  if (!force && Date.now() - loadedAt < RELOAD_AFTER_MS) return;
  loadedAt = Date.now();
  try {
    const next = await listCustomerAnalytics();
    // The same run as before: nothing to save or re-render
    if (next.updatedAt !== null && next.updatedAt === cachedAnalytics?.updatedAt) return;
    cachedAnalytics = next;
    writeStored(STORAGE_KEY, JSON.stringify(next));
    for (const listener of listeners) listener();
  } catch {
    // Not reported: these are extras, 統計 works without them (an older script
    // deployment without this action lands here too). Allow a retry next focus.
    loadedAt = 0;
  }
}

/** The nightly analysis results for 統計, or null until any have loaded. */
export function useCustomerAnalytics() {
  const analytics = useSyncExternalStore(subscribe, getCachedAnalytics);

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [])
  );

  return { analytics, reload: useCallback(() => load(true), []) };
}

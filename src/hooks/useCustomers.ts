import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { listCustomers } from '@/services/appointmentsApi';
import type { Customer, CustomerKey } from '@/types/customer';
import { readStored, writeStored } from '@/utils/persistentStorage';
import { reuseUnchanged } from '@/utils/reuseUnchanged';

const nameCollator = new Intl.Collator('zh-Hant');

const STORAGE_KEY = 'customers-cache-v1';

/**
 * Last loaded list, shared by every screen that uses customers, so they show
 * it at once and refresh in the background. Saved on the device too, so it's
 * there straight after launch.
 */
let cachedCustomers: Customer[] | null = readStoredCustomers();

function readStoredCustomers(): Customer[] | null {
  try {
    const parsed: unknown = JSON.parse(readStored(STORAGE_KEY) ?? 'null');
    return Array.isArray(parsed) ? (parsed as Customer[]) : null;
  } catch {
    return null;
  }
}

/** Every change to the list goes through here, so it's saved on the device too. */
function setCachedCustomers(next: Customer[]): void {
  cachedCustomers = next;
  writeStored(STORAGE_KEY, JSON.stringify(next));
}

function matches(customer: Customer, key: CustomerKey): boolean {
  return key.id ? customer.id === key.id : customer.name === key.name;
}

/** Look up a customer already loaded by the list, e.g. to show its details. */
export function findCachedCustomer(key: CustomerKey): Customer | undefined {
  return cachedCustomers?.find((c) => matches(c, key));
}

/** Add a new customer locally, so the list shows it before the next reload. */
export function addCachedCustomer(created: Customer): void {
  if (!cachedCustomers) return;
  setCachedCustomers(
    [...cachedCustomers, created].sort((a, b) => nameCollator.compare(a.name, b.name))
  );
}

/** Apply an edit locally, so the list shows it before the next reload. */
export function updateCachedCustomer(key: CustomerKey, updated: Customer): void {
  if (!cachedCustomers) return;
  setCachedCustomers(
    cachedCustomers
      .map((c) => (matches(c, key) ? updated : c))
      .sort((a, b) => nameCollator.compare(a.name, b.name))
  );
}

/** Drop a deleted customer locally, so the list hides it at once. */
export function removeCachedCustomer(key: CustomerKey): void {
  if (!cachedCustomers) return;
  setCachedCustomers(cachedCustomers.filter((c) => !matches(c, key)));
}

/** Customers from the 顧客 sheet, sorted by name. Reloads on focus. */
export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>(() => cachedCustomers ?? []);
  const [loading, setLoading] = useState(cachedCustomers === null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    // Show local edits (e.g. from the details screen) while reloading
    if (cachedCustomers) setCustomers(cachedCustomers);
    try {
      const data = await listCustomers();
      const next = reuseUnchanged(
        cachedCustomers,
        data.sort((a, b) => nameCollator.compare(a.name, b.name)),
        (c) => c.id || c.name
      );
      // Unchanged reloads keep the same array: nothing to save or re-render
      if (next !== cachedCustomers) setCachedCustomers(next);
      setCustomers(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入失敗');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return { customers, loading, refreshing, error, reload: load };
}

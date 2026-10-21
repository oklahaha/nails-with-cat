import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { listCustomers } from '@/services/appointmentsApi';
import type { Customer, CustomerKey } from '@/types/customer';

const nameCollator = new Intl.Collator('zh-Hant');

/**
 * Last loaded list, shared by every screen that uses customers, so they show
 * it at once and refresh in the background.
 */
let cachedCustomers: Customer[] | null = null;

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
  cachedCustomers = [...cachedCustomers, created].sort((a, b) =>
    nameCollator.compare(a.name, b.name)
  );
}

/** Apply an edit locally, so the list shows it before the next reload. */
export function updateCachedCustomer(key: CustomerKey, updated: Customer): void {
  if (!cachedCustomers) return;
  cachedCustomers = cachedCustomers
    .map((c) => (matches(c, key) ? updated : c))
    .sort((a, b) => nameCollator.compare(a.name, b.name));
}

/** Drop a deleted customer locally, so the list hides it at once. */
export function removeCachedCustomer(key: CustomerKey): void {
  if (!cachedCustomers) return;
  cachedCustomers = cachedCustomers.filter((c) => !matches(c, key));
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
      cachedCustomers = data.sort((a, b) => nameCollator.compare(a.name, b.name));
      setCustomers(cachedCustomers);
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

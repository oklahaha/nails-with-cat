import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { listCustomers } from '@/services/appointmentsApi';
import type { Customer } from '@/types/customer';

const nameCollator = new Intl.Collator('zh-Hant');

/**
 * Last loaded list, shared by every screen that uses customers, so they show
 * it at once and refresh in the background.
 */
let cachedCustomers: Customer[] | null = null;

/** Customers from the 顧客 sheet, sorted by name. Reloads on focus. */
export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>(() => cachedCustomers ?? []);
  const [loading, setLoading] = useState(cachedCustomers === null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
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

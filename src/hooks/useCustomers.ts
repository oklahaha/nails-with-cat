import { useFocusEffect } from 'expo-router';
import { useCallback, useState, useSyncExternalStore } from 'react';

import { listCustomers } from '@/services/appointmentsApi';
import type { Customer, CustomerKey } from '@/types/customer';
import { readStored, writeStored } from '@/utils/persistentStorage';
import { reuseUnchanged } from '@/utils/reuseUnchanged';

const nameCollator = new Intl.Collator('zh-Hant');

const STORAGE_KEY = 'customers-cache-v1';

const EMPTY: Customer[] = [];

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

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getCachedCustomers(): Customer[] | null {
  return cachedCustomers;
}

/**
 * Every change to the list goes through here, so it's saved on the device
 * too, and every screen using customers re-renders.
 */
function setCachedCustomers(next: Customer[]): void {
  cachedCustomers = next;
  writeStored(STORAGE_KEY, JSON.stringify(next));
  for (const listener of listeners) listener();
}

function sortByName(list: Customer[]): Customer[] {
  return list.sort((a, b) => nameCollator.compare(a.name, b.name));
}

/**
 * `list` with the customer at `key` replaced by `customer`, or dropped when
 * it's null. Any row with the new id or name is replaced too, so a customer
 * whose 顧客ID just came back isn't listed twice.
 */
function withCustomer(list: Customer[], key: CustomerKey, customer: Customer | null): Customer[] {
  const rest = list.filter(
    (c) =>
      !matches(c, key) &&
      !(customer && ((customer.id && c.id === customer.id) || c.name === customer.name))
  );
  if (!customer) return rest.length === list.length ? list : rest;
  return sortByName([...rest, customer]);
}

/**
 * Writes made in the app that a reload must not undo: those still being
 * sent, and those that finished after the reload started. Keyed by
 * keyString of the customer they change; `customer` is null for a delete.
 */
const localWrites = new Map<
  string,
  { key: CustomerKey; customer: Customer | null; pending: boolean; at: number }
>();
const LOCAL_WRITE_TTL_MS = 2 * 60 * 1000;

function keyString(key: CustomerKey): string {
  return key.id ? `id:${key.id}` : `name:${key.name}`;
}

function applyLocalWrites(list: Customer[], startedAt: number): Customer[] {
  let next = list;
  for (const [k, write] of localWrites) {
    if (!write.pending && Date.now() - write.at > LOCAL_WRITE_TTL_MS) {
      localWrites.delete(k);
    } else if (write.pending || write.at >= startedAt) {
      next = withCustomer(next, write.key, write.customer);
    }
  }
  return next;
}

/** Show an add / edit (`customer`) or delete (null) at once, while it's being sent. */
export function setPendingCustomer(key: CustomerKey, customer: Customer | null): void {
  localWrites.set(keyString(key), { key, customer, pending: true, at: Date.now() });
  setCachedCustomers(withCustomer(cachedCustomers ?? [], key, customer));
}

/** The write for `key` is done (or undone, after a failure): show `customer`. */
export function settleCustomer(key: CustomerKey, customer: Customer | null): void {
  localWrites.set(keyString(key), { key, customer, pending: false, at: Date.now() });
  setCachedCustomers(withCustomer(cachedCustomers ?? [], key, customer));
}

function matches(customer: Customer, key: CustomerKey): boolean {
  return key.id ? customer.id === key.id : customer.name === key.name;
}

/** Look up a customer already loaded by the list, e.g. to show its details. */
export function findCachedCustomer(key: CustomerKey): Customer | undefined {
  return cachedCustomers?.find((c) => matches(c, key));
}

/** Customers from the 顧客 sheet, sorted by name. Reloads on focus. */
export function useCustomers() {
  const customers = useSyncExternalStore(subscribe, getCachedCustomers) ?? EMPTY;
  const [loading, setLoading] = useState(cachedCustomers === null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const startedAt = Date.now();
    try {
      const data = await listCustomers();
      const next = reuseUnchanged(
        cachedCustomers,
        applyLocalWrites(sortByName(data), startedAt),
        (c) => c.id || c.name
      );
      // Unchanged reloads keep the same array: nothing to save or re-render
      if (next !== cachedCustomers) setCachedCustomers(next);
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

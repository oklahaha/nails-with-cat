import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';

import {
  listAppointments,
  listCustomerAppointments,
  type ListAppointmentsOptions,
} from '@/services/appointmentsApi';
import type { Appointment } from '@/types/appointment';
import type { CustomerKey } from '@/types/customer';

const EMPTY: Appointment[] = [];

/**
 * Last result per date range (or per customer's history), kept for the app's
 * lifetime. Apps Script calls take a second or more, so screens show cached
 * data at once and refresh it in the background (stale-while-revalidate).
 */
const cache = new Map<string, Appointment[]>();
/** Requests in flight per key, so a prefetch and a screen load share one call. */
const inflight = new Map<string, Promise<Appointment[]>>();

function rangeKey({ from, to }: ListAppointmentsOptions): string {
  return `${from ?? ''}|${to ?? ''}`;
}

function customerKey({ id, name }: CustomerKey): string {
  return `customer:${id || ''}:${name}`;
}

function fetchRange(range: ListAppointmentsOptions): Promise<Appointment[]> {
  return fetchCached(rangeKey(range), () => listAppointments(range));
}

function fetchCached(key: string, load: () => Promise<Appointment[]>): Promise<Appointment[]> {
  let request = inflight.get(key);
  if (!request) {
    request = load()
      .then((data) => {
        cache.set(key, data);
        return data;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, request);
  }
  return request;
}

/** Warm the cache for a range the user is likely to open next. */
export function prefetchAppointments(range: ListAppointmentsOptions): void {
  if (cache.has(rangeKey(range))) return;
  fetchRange(range).catch(() => {
    // Ignored: the screen shows the error if it loads this range itself
  });
}

/** Look up an appointment already loaded by any screen, e.g. to edit it. */
export function findCachedAppointment(id: string): Appointment | undefined {
  for (const list of cache.values()) {
    const found = list.find((apt) => apt.id === id);
    if (found) return found;
  }
  return undefined;
}

/** Drop a deleted appointment from every cached range, so it disappears at once. */
export function removeCachedAppointment(id: string): void {
  for (const [key, list] of cache) {
    if (list.some((apt) => apt.id === id)) {
      cache.set(key, list.filter((apt) => apt.id !== id));
    }
  }
}

type Result = {
  key: string;
  appointments?: Appointment[];
  error: string | null;
};

/**
 * Load appointments for a date range. Reloads when the range changes and
 * whenever the screen regains focus (e.g. after adding an appointment).
 *
 * `loading` is only true when there's nothing to show yet for this range;
 * reloads over cached data set `reloading` instead. Pass `enabled: false` to
 * skip loading until the range is known.
 */
export function useAppointments(
  { from, to }: ListAppointmentsOptions,
  { enabled = true }: { enabled?: boolean } = {}
) {
  const key = rangeKey({ from, to });
  const [result, setResult] = useState<Result>(() => ({
    key,
    appointments: cache.get(key),
    error: null,
  }));
  const [reloading, setReloading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Ignore responses from older requests when the range changes quickly
  const requestIdRef = useRef(0);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!enabled) return;
      const requestId = ++requestIdRef.current;
      const k = rangeKey({ from, to });
      if (isRefresh) setRefreshing(true);
      else if (cache.has(k)) setReloading(true);

      try {
        const data = await fetchRange({ from, to });
        if (requestId !== requestIdRef.current) return;
        setResult({ key: k, appointments: data, error: null });
      } catch (e) {
        if (requestId !== requestIdRef.current) return;
        setResult({
          key: k,
          appointments: cache.get(k),
          error: e instanceof Error ? e.message : '載入失敗',
        });
      } finally {
        if (requestId === requestIdRef.current) {
          setReloading(false);
          setRefreshing(false);
        }
      }
    },
    [from, to, enabled]
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // The cache is never older than `result` (fetches fill it first), and it
  // also reflects local edits such as removeCachedAppointment, so prefer it.
  // After a range change, this shows that range's cache until its own result lands.
  const current = cache.get(key) ?? (result.key === key ? result.appointments : undefined);
  const error = result.key === key ? result.error : null;

  return {
    appointments: current ?? EMPTY,
    loading: enabled && current === undefined && error === null,
    reloading,
    refreshing,
    error,
    reload: load,
  };
}

/**
 * Every appointment for one customer, newest first, for the history in
 * 顧客資料. Cached like date ranges, so the appointment details screen can
 * open any of them, and reloaded whenever the screen regains focus.
 */
export function useCustomerAppointments(customer: CustomerKey | undefined) {
  const key = customer ? customerKey(customer) : '';
  const [result, setResult] = useState<Result>(() => ({
    key,
    appointments: cache.get(key),
    error: null,
  }));
  const requestIdRef = useRef(0);

  const id = customer?.id;
  const name = customer?.name;
  const load = useCallback(async () => {
    if (name === undefined) return;
    const requestId = ++requestIdRef.current;
    const k = customerKey({ id, name });
    try {
      const data = await fetchCached(k, () => listCustomerAppointments({ id, name }));
      if (requestId !== requestIdRef.current) return;
      setResult({ key: k, appointments: data, error: null });
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setResult({
        key: k,
        appointments: cache.get(k),
        error: e instanceof Error ? e.message : '載入失敗',
      });
    }
  }, [id, name]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // Same preference for the cache as useAppointments, so deletes show at once
  const current = cache.get(key) ?? (result.key === key ? result.appointments : undefined);
  const error = result.key === key ? result.error : null;
  const sorted = useMemo(
    () =>
      [...(current ?? EMPTY)].sort((a, b) =>
        `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)
      ),
    [current]
  );

  return {
    appointments: sorted,
    loading: Boolean(customer) && current === undefined && error === null,
    error,
    reload: load,
  };
}

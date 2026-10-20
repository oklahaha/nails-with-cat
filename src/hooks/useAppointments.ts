import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import {
  listAppointments,
  type ListAppointmentsOptions,
} from '@/services/appointmentsApi';
import type { Appointment } from '@/types/appointment';

const EMPTY: Appointment[] = [];

/**
 * Last result per date range, kept for the app's lifetime. Apps Script calls
 * take a second or more, so screens show cached data at once and refresh it
 * in the background (stale-while-revalidate).
 */
const cache = new Map<string, Appointment[]>();
/** Requests in flight per range, so a prefetch and a screen load share one call. */
const inflight = new Map<string, Promise<Appointment[]>>();

function rangeKey({ from, to }: ListAppointmentsOptions): string {
  return `${from ?? ''}|${to ?? ''}`;
}

function fetchRange(range: ListAppointmentsOptions): Promise<Appointment[]> {
  const key = rangeKey(range);
  let request = inflight.get(key);
  if (!request) {
    request = listAppointments(range)
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

  // After a range change, show that range's cache until its own result lands
  const current = result.key === key ? result.appointments : cache.get(key);
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

import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import {
  listAppointments,
  listCustomerAppointments,
  type ListAppointmentsOptions,
} from '@/services/appointmentsApi';
import type { Appointment } from '@/types/appointment';
import type { CustomerKey } from '@/types/customer';
import { readStored, removeStored, writeStored } from '@/utils/persistentStorage';
import { reuseUnchanged } from '@/utils/reuseUnchanged';
import { parseRanges, serializeRanges } from '@/utils/storedAppointments';

const EMPTY: Appointment[] = [];

const STORAGE_KEY = 'appointments-cache-v2';
/** v1 saved each range's bookings in full; drop what's left of it. */
removeStored('appointments-cache-v1');
/** Most recently loaded ranges kept on the device, so storage doesn't grow. */
const MAX_STORED = 24;

/**
 * Last result per date range (or per customer's history). Apps Script calls
 * take seconds, so screens show cached data at once and refresh it in the
 * background (stale-while-revalidate). It's also saved on the device and
 * read back on launch, so even the first screen opens with the last data.
 */
const cache = new Map<string, Appointment[]>(parseRanges(readStored(STORAGE_KEY)));
/** When each key was last written, to keep only the newest MAX_STORED. */
const writtenAt = new Map<string, number>([...cache.keys()].map((key, i) => [key, i]));
let saveTimer: ReturnType<typeof setTimeout> | undefined;

/** Bumped on every cache write, so hooks re-render for changes made elsewhere. */
let cacheVersion = 0;
const cacheListeners = new Set<() => void>();

function subscribeCache(listener: () => void): () => void {
  cacheListeners.add(listener);
  return () => cacheListeners.delete(listener);
}

/**
 * Re-render when the cache for `key` changes: its own list once cached, so
 * writes to other ranges (e.g. prefetches) don't re-render it, or else any
 * write, since a covering range may change what it shows.
 */
function useCacheSnapshot(key: string): Appointment[] | number {
  return useSyncExternalStore(
    subscribeCache,
    useCallback(() => cache.get(key) ?? cacheVersion, [key])
  );
}

/** Every cache write goes through here, so it's saved on the device too. */
function setCache(key: string, list: Appointment[]): void {
  cache.set(key, list);
  writtenAt.set(key, Date.now());
  cacheVersion++;
  for (const listener of cacheListeners) listener();
  // Several writes often land together (a load plus prefetches): save once
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const newest = [...cache.entries()]
      .sort(([a], [b]) => (writtenAt.get(b) ?? 0) - (writtenAt.get(a) ?? 0))
      .slice(0, MAX_STORED);
    writeStored(STORAGE_KEY, serializeRanges(newest));
  }, 1000);
}
/** Requests in flight per key, so a prefetch and a screen load share one call. */
const inflight = new Map<string, Promise<Appointment[]>>();

function rangeKey({ from, to }: ListAppointmentsOptions): string {
  return `${from ?? ''}|${to ?? ''}`;
}

function customerKey({ id, name }: CustomerKey): string {
  return `customer:${id || ''}:${name}`;
}

/**
 * Load a range through the cache, sharing a request already running for it.
 * Screens use useAppointments; this is for loads outside one (the widget sync).
 */
export function loadAppointments(range: ListAppointmentsOptions): Promise<Appointment[]> {
  return fetchCached(rangeKey(range), () => listAppointments(range));
}

function fetchCached(key: string, load: () => Promise<Appointment[]>): Promise<Appointment[]> {
  let request = inflight.get(key);
  if (!request) {
    const startedAt = Date.now();
    request = load()
      .then((data) => {
        const withLocal = applyLocalWrites(key, data, startedAt);
        const merged = reuseUnchanged(cache.get(key), withLocal, (apt) => apt.id);
        setCache(key, merged);
        return merged;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, request);
  }
  return request;
}

/** Warm the cache for a range the user is likely to open next. */
export function prefetchAppointments(range: ListAppointmentsOptions): void {
  if (cache.has(rangeKey(range))) return;
  loadAppointments(range).catch(() => {
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

/**
 * Put a just-saved appointment into every cached range that covers its date
 * (and out of those that no longer do), so screens show it at once instead
 * of after the next Apps Script reload. Customer histories only get edits.
 */
export function upsertCachedAppointment(saved: Appointment): void {
  for (const [key, list] of cache) {
    const next = withAppointment(key, list, saved.id, saved);
    if (next !== list) setCache(key, next);
  }
}

/**
 * `list` with `id` replaced by `apt`, or dropped when `apt` is null or out of
 * range. `apt` may carry a new id (a new booking's real 預約ID), which
 * replaces any row already holding it, so it's never listed twice.
 */
function withAppointment(
  key: string,
  list: Appointment[],
  id: string,
  apt: Appointment | null
): Appointment[] {
  const matches = (a: Appointment) => a.id === id || a.id === apt?.id;
  const index = list.findIndex(matches);
  const covers = apt ? rangeCovers(key, apt.date) : false;
  if (index === -1 && !covers) return list;
  const rest = list.filter((a) => !matches(a));
  if (!apt || covers === false) return rest;
  if (index === -1) return [...rest, apt];
  rest.splice(Math.min(index, rest.length), 0, apt);
  return rest;
}

/**
 * Writes made in the app that a reload must not undo: those still being sent
 * (pending), and those that finished after a reload started, whose response
 * may predate them. `apt` is null for a delete.
 */
const localWrites = new Map<string, { apt: Appointment | null; pending: boolean; at: number }>();
/** Finished writes are only needed by reloads that started before them. */
const LOCAL_WRITE_TTL_MS = 2 * 60 * 1000;

function applyLocalWrites(key: string, list: Appointment[], startedAt: number): Appointment[] {
  let next = list;
  for (const [id, write] of localWrites) {
    if (!write.pending && Date.now() - write.at > LOCAL_WRITE_TTL_MS) {
      localWrites.delete(id);
    } else if (write.pending || write.at >= startedAt) {
      next = withAppointment(key, next, id, write.apt);
    }
  }
  return next;
}

/**
 * Show a save (`apt`) or delete (null) in every cached list at once, while
 * it's still being sent to Apps Script, so reloads keep showing it.
 */
export function setPendingAppointment(id: string, apt: Appointment | null): void {
  localWrites.set(id, { apt, pending: true, at: Date.now() });
  applyToCache(id, apt);
}

/**
 * The write for `id` is done (or undone, after a failure): show `apt`, and
 * keep it over responses from reloads that started before now.
 */
export function settleAppointment(id: string, apt: Appointment | null): void {
  localWrites.set(id, { apt, pending: false, at: Date.now() });
  applyToCache(id, apt);
}

function applyToCache(id: string, apt: Appointment | null): void {
  for (const [key, list] of cache) {
    const next = withAppointment(key, list, id, apt);
    if (next !== list) setCache(key, next);
  }
}

/** Whether a date-range cache key covers `date`; undefined for customer histories. */
function rangeCovers(key: string, date: string): boolean | undefined {
  if (key.startsWith('customer:')) return undefined;
  const [from, to] = key.split('|');
  return (!from || date >= from) && (!to || date <= to);
}

/**
 * The appointments in `from`–`to` from any cached range that covers it, for
 * a range not loaded yet (e.g. the 補甲 / 補眼睫毛 price, which looks two
 * weeks back), so it shows at once while its own load runs.
 */
function fromCoveringRange(from: string | undefined, to: string | undefined) {
  for (const [key, list] of cache) {
    if (key.startsWith('customer:')) continue;
    const [f, t] = key.split('|');
    if ((!f || (from != null && from >= f)) && (!t || (to != null && to <= t))) {
      return list.filter((apt) => (!from || apt.date >= from) && (!to || apt.date <= to));
    }
  }
  return undefined;
}

/**
 * Show a customer's new name and phone on their cached bookings, as Apps
 * Script renames their 預約資料 rows too. `phone` is undefined to keep it.
 */
export function renameCachedCustomer(from: string, to: string, phone?: string): void {
  for (const [key, list] of cache) {
    if (!list.some((apt) => apt.customerName === from)) continue;
    setCache(
      key,
      list.map((apt) =>
        apt.customerName === from
          ? { ...apt, customerName: to, phone: phone ?? apt.phone }
          : apt
      )
    );
  }
}

/** Drop a deleted appointment from every cached range, so it disappears at once. */
export function removeCachedAppointment(id: string): void {
  for (const [key, list] of cache) {
    if (list.some((apt) => apt.id === id)) {
      setCache(key, list.filter((apt) => apt.id !== id));
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
        const data = await loadAppointments({ from, to });
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

  // Re-render when a save or delete elsewhere changes this range's cache
  const snapshot = useCacheSnapshot(key);
  // The cache is never older than `result` (fetches fill it first), and it
  // also reflects local edits such as removeCachedAppointment, so prefer it.
  // After a range change, this shows that range's cache until its own result
  // lands, or else what a wider cached range holds for it.
  const covering = useMemo(
    () => (cache.has(key) ? undefined : fromCoveringRange(from, to)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot tracks the cache
    [key, from, to, snapshot]
  );
  const current =
    cache.get(key) ?? (result.key === key ? result.appointments : undefined) ?? covering;
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

  useCacheSnapshot(key);
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

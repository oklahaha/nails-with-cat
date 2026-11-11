import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import {
  listAppointments,
  listCustomerAppointments,
  listFinishedPhotoAppointments,
  type ListAppointmentsOptions,
} from '@/services/appointmentsApi';
import type { Appointment } from '@/types/appointment';
import type { CustomerKey } from '@/types/customer';
import { readStored, removeStored, writeStored } from '@/utils/persistentStorage';
import {
  applyPhotoOps,
  livePhotoOps,
  type PhotoKind,
  withPhotosOf,
  type PhotoOp,
} from '@/utils/appointmentPhotos';
import { reuseUnchanged, shallowEqual } from '@/utils/reuseUnchanged';
import { parseRanges, serializeRanges } from '@/utils/storedAppointments';

const EMPTY: Appointment[] = [];

const STORAGE_KEY = 'appointments-cache-v4';
/** v1 saved each range's bookings in full, v2 predates keepDeposit, v3 the photos; drop them. */
removeStored('appointments-cache-v1');
removeStored('appointments-cache-v2');
removeStored('appointments-cache-v3');
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
  const snapshot = useCallback(() => cache.get(key) ?? cacheVersion, [key]);
  // The same on the server: web renders routes there first
  return useSyncExternalStore(subscribeCache, snapshot, snapshot);
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

/** The bookings with 完成作品, whatever their date: edited in the cache like a customer's history. */
const FINISHED_PHOTOS_KEY = 'photos:finished';

/** Lists kept by something other than a date range, so a booking's date doesn't decide what's in them. */
function isDateRangeKey(key: string): boolean {
  return !key.startsWith('customer:') && key !== FINISHED_PHOTOS_KEY;
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
        // A reload that started earlier but answered later mustn't bring back
        // the old copies of rows a later-started one already returned
        const current = withRows(key, data, (id) => {
          const known = newest.get(id);
          return known && known.at > startedAt ? known.apt : undefined;
        });
        const withLocal = applyLocalWrites(key, current, startedAt);
        const merged = reuseUnchanged(cache.get(key), withLocal, (apt) => apt.id);
        setCache(key, merged);
        spreadFresh(key, merged, startedAt);
        return merged;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, request);
  }
  return request;
}

/** Per booking, its copy from the latest-started reload that returned it, and when that started. */
const newest = new Map<string, { at: number; apt: Appointment }>();

/**
 * `list` with each row that `latestOf` has another copy of swapped for that
 * copy, or dropped when the copy's date has left `key`'s range.
 */
function withRows(
  key: string,
  list: Appointment[],
  latestOf: (id: string) => Appointment | undefined
): Appointment[] {
  let changed = false;
  const next = list.flatMap((apt) => {
    const latest = latestOf(apt.id);
    if (!latest || latest === apt || shallowEqual(latest, apt)) return [apt];
    changed = true;
    return rangeCovers(key, latest.date) === false ? [] : [latest];
  });
  return changed ? next : list;
}

/**
 * Copy the rows a reload of `fromKey` just returned into every other cached
 * list holding them. Without this a list not reloaded (the timetable's month
 * while the push sync reloads only today onwards) keeps an old copy, and No
 * show or 保留訂金, which send every column, would write the old values back
 * over the other phone's edit.
 */
function spreadFresh(fromKey: string, fresh: Appointment[], startedAt: number): void {
  for (const apt of fresh) {
    const known = newest.get(apt.id);
    if (!known || known.at <= startedAt) newest.set(apt.id, { at: startedAt, apt });
  }
  const byId = new Map(fresh.map((apt) => [apt.id, apt]));
  for (const [key, list] of cache) {
    if (key === fromKey) continue;
    const next = withRows(key, list, (id) => byId.get(id));
    if (next !== list) setCache(key, next);
  }
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
  rest.splice(Math.min(index, rest.length), 0, withPhotosOf(list[index], apt));
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
  return withPhotoOps(next, startedAt);
}

/**
 * Photos being added or removed, or done since a reload may have started.
 * They're applied over every list, so neither a reload's older response nor a
 * booking edit saved just before can bring back the photos as they were.
 */
let photoOps: PhotoOp[] = [];

function withPhotoOps(list: Appointment[], startedAt?: number): Appointment[] {
  photoOps = livePhotoOps(photoOps, Date.now());
  if (photoOps.length === 0) return list;
  let changed = false;
  const next = list.map((apt) => {
    const shown = applyPhotoOps(apt, photoOps, startedAt);
    if (shown !== apt) changed = true;
    return shown;
  });
  return changed ? next : list;
}

/** Show the photo changes in every cached list, and tell screens about pending ones. */
function refreshPhotos(id: string, change: (apt: Appointment) => Appointment): void {
  for (const [key, list] of cache) {
    if (!list.some((apt) => apt.id === id)) continue;
    setCache(key, list.map((apt) => (apt.id === id ? change(apt) : apt)));
  }
  cacheVersion++;
  for (const listener of cacheListeners) listener();
}

/** Show a photo added or removed at once, while it's being sent. */
export function setPendingPhoto(
  appointmentId: string,
  kind: PhotoKind,
  path: string,
  type: PhotoOp['type']
): void {
  const op: PhotoOp = { appointmentId, kind, path, type, pending: true, at: Date.now() };
  photoOps = [...photoOps.filter((o) => o.path !== path), op];
  refreshPhotos(appointmentId, (apt) => applyPhotoOps(apt, [op]));
  // A booking's first 完成作品 joins the 作品 tab's list without waiting for a reload
  const gallery = cache.get(FINISHED_PHOTOS_KEY);
  const apt = findCachedAppointment(appointmentId);
  if (kind === 'finished' && type === 'add' && gallery && apt) {
    if (!gallery.some((a) => a.id === appointmentId)) setCache(FINISHED_PHOTOS_KEY, [...gallery, apt]);
  }
}

/** The photo write is done: keep it over reloads that started before now. */
export function settlePhoto(path: string, type: PhotoOp['type']): void {
  // A photo removed while still uploading has its add replaced by the remove
  const op = photoOps.find((o) => o.path === path && o.type === type);
  if (!op) return;
  photoOps = photoOps.map((o) => (o === op ? { ...o, pending: false, at: Date.now() } : o));
  refreshPhotos(op.appointmentId, (apt) => apt);
}

/** The photo write failed: undo it in every list. */
export function undoPhoto(path: string, type: PhotoOp['type']): void {
  const op = photoOps.find((o) => o.path === path && o.type === type);
  if (!op) return;
  photoOps = photoOps.filter((o) => o !== op);
  const opposite: PhotoOp = { ...op, type: op.type === 'add' ? 'remove' : 'add' };
  refreshPhotos(op.appointmentId, (apt) => applyPhotoOps(apt, [opposite]));
}

/** The photos still being sent, joined so the result is stable between changes. */
function pendingPhotoKey(): string {
  return photoOps
    .filter((op) => op.pending && op.type === 'add')
    .map((op) => op.path)
    .join('\n');
}

/** Paths of the photos still uploading, to mark them on screen. */
export function usePendingPhotos(): ReadonlySet<string> {
  const key = useSyncExternalStore(subscribeCache, pendingPhotoKey, pendingPhotoKey);
  return useMemo(() => new Set(key ? key.split('\n') : []), [key]);
}

/**
 * The cached booking as it is now, for what can change while its details are
 * open (the photos); those screens otherwise keep the snapshot they opened with.
 */
export function useLiveAppointment(id: string | undefined): Appointment | undefined {
  const snapshot = () => (id ? findCachedAppointment(id) : undefined);
  return useSyncExternalStore(subscribeCache, snapshot, snapshot);
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
  const shown = apt && applyPhotoOps(apt, photoOps);
  for (const [key, list] of cache) {
    const next = withAppointment(key, list, id, shown);
    if (next !== list) setCache(key, next);
  }
}

/** Whether a date-range cache key covers `date`; undefined for customer histories. */
function rangeCovers(key: string, date: string): boolean | undefined {
  if (!isDateRangeKey(key)) return undefined;
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
    if (!isDateRangeKey(key)) continue;
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
  // also reflects local edits such as a pending delete, so prefer it.
  // After a range change, this shows that range's cache until its own result
  // lands, or else what a wider cached range holds for it.
  const covering = useMemo(
    () => (cache.has(key) ? undefined : fromCoveringRange(from, to)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot tracks the cache
    [key, from, to, snapshot]
  );
  const current =
    cache.get(key) ?? (result.key === key ? result.appointments : undefined) ?? covering;
  // A failed reload over cached data keeps showing that data, unsynced
  const error = result.key === key && current === undefined ? result.error : null;

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
 * What the cache holds for a range (or a wider cached range), without loading
 * it: for pages drawn beside the one on screen (the iOS timetable pager),
 * whose ranges the screen prefetches.
 */
export function useCachedAppointments({ from, to }: ListAppointmentsOptions): Appointment[] {
  const key = rangeKey({ from, to });
  const snapshot = useCacheSnapshot(key);
  return useMemo(
    () => cache.get(key) ?? fromCoveringRange(from, to) ?? EMPTY,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot tracks the cache
    [key, from, to, snapshot]
  );
}

/**
 * Every booking with 完成作品, for the 作品 tab. Cached like date ranges, so
 * the details screen can open any of them, and reloaded on focus.
 */
export function useFinishedPhotoAppointments() {
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      await fetchCached(FINISHED_PHOTOS_KEY, listFinishedPhotoAppointments);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入失敗');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const current = useCacheSnapshot(FINISHED_PHOTOS_KEY);
  const appointments = typeof current === 'number' ? undefined : current;
  return {
    appointments: appointments ?? EMPTY,
    loading: appointments === undefined && error === null,
    error,
    reload: load,
  };
}

/** What the cache holds for the 作品 tab, without loading it: for its viewer. */
export function useCachedFinishedPhotoAppointments(): Appointment[] {
  const current = useCacheSnapshot(FINISHED_PHOTOS_KEY);
  return typeof current === 'number' ? EMPTY : current;
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

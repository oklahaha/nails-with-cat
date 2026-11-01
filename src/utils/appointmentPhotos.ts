/**
 * Rules for a booking's photos: 參考作品 (what the customer asked for, added
 * from the form or the details) and 完成作品 (the finished work, once the
 * booking has started). Each photo is known by its Drive path, the sheet's
 * value, which the app picks so it can be shown before it's uploaded.
 */
import { NO_SHOW, type Appointment } from '@/types/appointment';
import { toIsoDate } from '@/utils/dates';

export type PhotoKind = 'reference' | 'finished';
/** Thumbnails come from Drive's small preview, and the viewer opens the full file. */
export type PhotoSize = 'thumb' | 'full';

export const PHOTO_KINDS = {
  reference: { title: '參考作品', folder: '參考作品_images', field: 'referencePhotos' },
  finished: { title: '完成作品', folder: '完成作品_images', field: 'finishedPhotos' },
} as const;

/** Per kind: enough for a few angles, and each one is a slow upload. */
export const MAX_PHOTOS = 6;

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** A new path, the shape AppSheet uses: <folder>/<22 chars>.<column>.<HHmmss>.jpg */
export function newPhotoPath(
  kind: PhotoKind,
  now = new Date(),
  random: () => number = Math.random
): string {
  const { folder, title } = PHOTO_KINDS[kind];
  let id = '';
  for (let i = 0; i < 22; i++) id += ID_CHARS[Math.floor(random() * ID_CHARS.length)];
  const stamp = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join('');
  return `${folder}/${id}.${title}.${stamp}.jpg`;
}

export function photosOf(apt: Appointment, kind: PhotoKind): string[] {
  return apt[PHOTO_KINDS[kind].field] ?? [];
}

function isCustomerRow(apt: Appointment): boolean {
  return apt.service !== '特別事項' && apt.customerName.trim() !== '';
}

/** Whether a booking shows 參考作品: every customer booking can have them. */
export function showsReferencePhotos(apt: Appointment): boolean {
  return isCustomerRow(apt);
}

/**
 * Whether a booking shows 完成作品: from its start time rather than 已完成,
 * which the hourly job only sets after End Time, so a photo can be taken as
 * soon as the work is done. A No show has none to add, but keeps any it has.
 */
export function showsFinishedPhotos(apt: Appointment, now = new Date()): boolean {
  if (photosOf(apt, 'finished').length > 0) return true;
  if (!isCustomerRow(apt) || apt.status === NO_SHOW) return false;
  if (apt.status === '已完成') return true;
  const today = toIsoDate(now);
  if (apt.date !== today) return apt.date < today;
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return apt.time <= clock;
}

/**
 * `apt` carrying `current`'s photos. Only photo writes change them, so a save
 * built from a snapshot taken earlier (an edit form, a details screen) can't
 * bring back the photos as they were then.
 */
export function withPhotosOf(current: Appointment, apt: Appointment): Appointment {
  const next = { ...apt };
  for (const { field } of Object.values(PHOTO_KINDS)) {
    const photos = current[field];
    if (photos) next[field] = photos;
    else delete next[field];
  }
  return next;
}

/** A photo being added or removed. `pending` until Apps Script has answered. */
export type PhotoOp = {
  appointmentId: string;
  kind: PhotoKind;
  path: string;
  type: 'add' | 'remove';
  pending: boolean;
  /** When it was made, or when it finished. */
  at: number;
};

/** Finished writes are only needed by reloads that started before them. */
const PHOTO_OP_TTL_MS = 2 * 60 * 1000;

export function livePhotoOps(ops: PhotoOp[], now: number): PhotoOp[] {
  const live = ops.filter((op) => op.pending || now - op.at <= PHOTO_OP_TTL_MS);
  return live.length === ops.length ? ops : live;
}

/**
 * `apt` with `ops` applied, the same object if nothing changes. With
 * `startedAt` (a reload's response), finished ops made before it are skipped,
 * since that response already includes them.
 */
export function applyPhotoOps(apt: Appointment, ops: PhotoOp[], startedAt?: number): Appointment {
  let next = apt;
  for (const op of ops) {
    if (op.appointmentId !== apt.id) continue;
    if (startedAt != null && !op.pending && op.at < startedAt) continue;
    const { field } = PHOTO_KINDS[op.kind];
    const paths = next[field] ?? [];
    const has = paths.includes(op.path);
    if (op.type === 'add' ? has : !has) continue;
    const changed = op.type === 'add' ? [...paths, op.path] : paths.filter((p) => p !== op.path);
    next = { ...next };
    if (changed.length > 0) next[field] = changed;
    else delete next[field];
  }
  return next;
}

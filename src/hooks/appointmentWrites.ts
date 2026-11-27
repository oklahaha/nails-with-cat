/**
 * Saves and deletes that don't make the user wait for Apps Script, which
 * takes several seconds per write: the change shows in every cached list at
 * once, the form closes, and the write is sent in the background. Writes run
 * one at a time in the order they were made, and survive the app being
 * closed (the queue is an outbox shared with customer writes, see
 * writeQueue). A new booking gets its 預約ID here, so it can be edited or
 * deleted while it's still being created. A failed write is undone in the
 * lists and reported with an alert.
 */
import {
  findCachedAppointment,
  setPendingAppointment,
  setPendingPhoto,
  settleAppointment,
  settlePhoto,
  undoPhoto,
} from '@/hooks/useAppointments';
import { syncUpcoming } from '@/hooks/useUpcomingSync';
import { findCachedCustomer, getCachedCustomers } from '@/hooks/useCustomers';
import { defineWrite } from '@/hooks/writeQueue';
import { withdrawWhatsAppConfirmation } from '@/hooks/whatsAppConfirmation';
import {
  addAppointmentPhoto,
  createAppointment,
  deleteAppointment,
  AuthError,
  isRetryable,
  removeAppointmentPhoto,
  updateAppointment,
} from '@/services/appointmentsApi';
import { discardPhoto, markPhotoUploaded, readPendingPhoto } from '@/services/photoFiles';
import type { ServiceType } from '@/constants/services';
import type {
  Appointment,
  AppointmentStatus,
  UpdateAppointmentInput,
} from '@/types/appointment';
import { showAlert } from '@/utils/alert';
import { photosOf, type PhotoKind } from '@/utils/appointmentPhotos';
import { appointmentTitle } from '@/utils/appointmentTitle';
import { withQuotes } from '@/utils/quotes';
import { minutesToTime, timeToMinutes } from '@/utils/dates';
import { formatDateHeader } from '@/utils/groupByDate';
import { randomId } from '@/utils/randomId';
import { hapticWarning } from '@/utils/haptics';

/**
 * Bookings being created: their 預約ID once Apps Script has the row, or
 * null if creating it failed, and how to settle that.
 */
const creates = new Map<
  string,
  { realId: Promise<string | null>; settle: (real: string | null) => void }
>();
/**
 * The 預約ID Apps Script gave a booking, when it isn't the one sent: scripts
 * deployed before the app chose its own ids make up their own.
 */
const realIds = new Map<string, string>();

/** Let edits and deletes queued behind a new booking wait for its 預約ID. */
function trackCreate(id: string): void {
  let settle!: (real: string | null) => void;
  const realId = new Promise<string | null>((resolve) => (settle = resolve));
  creates.set(id, { realId, settle });
}

function settleCreate(id: string, real: string | null): void {
  creates.get(id)?.settle(real);
}

/** Its create already reported the failure, so what waited for it needn't. */
const CREATE_FAILED = new Error('此預約未能新增');

/**
 * The 預約ID to send for `id`, which may be a booking still being created.
 * If its create failed, `strict` throws CREATE_FAILED (for photos queued
 * behind it, so they don't each report it); otherwise `id` is sent, since a
 * create can fail after writing the row (a reload then shows the booking).
 */
async function sheetId(id: string, strict = false): Promise<string> {
  const created = creates.get(id);
  if (!created) return realIds.get(id) ?? id;
  const real = await created.realId;
  if (real != null) return real;
  if (strict) throw CREATE_FAILED;
  return id;
}

function reportFailure(action: string, apt: Appointment, e: unknown): void {
  void syncUpcoming();
  const what = `${appointmentTitle(apt)} ${formatDateHeader(apt.date)} ${apt.time}`;
  showAlert(`${action}失敗`, `${what}\n${e instanceof Error ? e.message : '未知錯誤'}`);
}

/** How the booking will look once saved, built locally from the form's input. */
function localAppointment(id: string, input: UpdateAppointmentInput, before?: Appointment) {
  const name = input.customerName.trim();
  // The customer list is current (a phone changed or the customer deleted since
  // `before` was loaded); the booking's own copy only until the list has loaded
  const phone = getCachedCustomers()
    ? findCachedCustomer({ name })?.phone
    : before && before.customerName === name
      ? before.phone
      : undefined;
  const isSpecial = input.service === '特別事項';
  const { quotesByPath, ...fields } = input;
  // The booking as cached now: its photos may have changed since `before` was opened
  const current = before && (findCachedAppointment(before.id) ?? before);
  return {
    ...before,
    ...fields,
    // Paired with the photos they're by position for, as withPhotosOf expects
    referencePhotos: current?.referencePhotos,
    quotes:
      current && quotesByPath
        ? withQuotes(current.referencePhotos ?? [], current.quotes, quotesByPath)
        : current?.quotes,
    id,
    customerName: name,
    notes: input.notes.trim(),
    phone,
    status: input.status ?? before?.status ?? (isSpecial ? '' : '預約'),
    endTime:
      input.durationMinutes != null
        ? minutesToTime(timeToMinutes(input.time) + input.durationMinutes)
        : input.time,
  } satisfies Appointment;
}

type SavePayload = {
  id: string;
  input: UpdateAppointmentInput;
  /** The booking as shown while it's sent. */
  local: Appointment;
  /** The booking before an edit; absent for a new one. */
  before?: Appointment;
  /** An edit's id, kept in the outbox, so a resend isn't applied twice. */
  writeId?: string;
};

/**
 * A save queued by an app from before 報價 by photo carries the booking's
 * single `quote`, sent on every save (No show and 保留訂金 too): send it, by
 * the photo it was for, only when it differs from the booking's `before`.
 * (A cleared 報價 was left out, like an unchanged one, so it's not sent.)
 */
export function withoutLegacyQuote(
  input: UpdateAppointmentInput,
  before?: Appointment
): UpdateAppointmentInput {
  const { quote, ...rest } = input as UpdateAppointmentInput & { quote?: number };
  const first = before?.referencePhotos?.[0];
  const was = (before as (Appointment & { quote?: number }) | undefined)?.quote;
  if (quote == null || quote === was || !first || rest.quotesByPath) return rest;
  return { ...rest, quotesByPath: { [first]: quote } };
}

/** Send once more if the first try may not have arrived (offline, timed out, lock busy). */
function retryOnce<T>(send: () => Promise<T>): Promise<T> {
  return send().catch((e: unknown) => {
    if (!isRetryable(e)) throw e;
    return send();
  });
}

/** Show the save at once, while it's sent. */
function showSave({ id, local, before }: SavePayload): void {
  if (!before) trackCreate(id);
  setPendingAppointment(id, local);
}

const sendSave = defineWrite<SavePayload>('saveAppointment', {
  restore: (payload) => {
    // An edit queued before write ids: given one before its first send, so
    // its retry can't overwrite an edit the other phone made meanwhile
    if (payload.before && !payload.writeId) payload.writeId = randomId();
    showSave(payload);
  },
  run: async ({ id, input: queued, local, before, writeId }) => {
    const input = withoutLegacyQuote(queued, before);
    if (before) {
      try {
        const realId = await sheetId(id);
        const { repeated, ...saved } = await retryOnce(() =>
          updateAppointment(realId, input, writeId)
        );
        // A resend already saved answers with the sheet's row as it is now: take
        // it whole, so fields cleared since (left out of it) stay cleared
        const base = repeated ? {} : local;
        settleAppointment(id, { ...base, ...saved, id: realId, phone: saved.phone || local.phone });
      } catch (e) {
        if (e instanceof AuthError) throw e;
        settleAppointment(id, { ...before, id });
        withdrawWhatsAppConfirmation(local);
        reportFailure('儲存', local, e);
      }
      return;
    }
    try {
      // A first try can fail after the row was written (e.g. timed out); a resend
      // with the same 預約ID then answers with that row instead of adding another
      const saved = await retryOnce(() => createAppointment(input, id));
      if (saved.id !== id) realIds.set(id, saved.id);
      settleCreate(id, saved.id);
      settleAppointment(id, { ...local, ...saved, phone: saved.phone || local.phone });
    } catch (e) {
      if (e instanceof AuthError) throw e;
      settleCreate(id, null);
      settleAppointment(id, null);
      withdrawWhatsAppConfirmation(local);
      reportFailure('新增', local, e);
    }
  },
});

type DeletePayload = { id: string; apt: Appointment };

const sendDelete = defineWrite<DeletePayload>('deleteAppointment', {
  restore: ({ id }) => setPendingAppointment(id, null),
  run: async ({ id, apt }) => {
    try {
      const realId = await sheetId(id);
      await deleteAppointment(realId);
      settleAppointment(realId, null);
      if (realId !== id) settleAppointment(id, null);
    } catch (e) {
      if (e instanceof AuthError) throw e;
      settleAppointment(id, { ...apt, id });
      reportFailure('刪除', apt, e);
    }
  },
});

type PhotoPayload = { apt: Appointment; kind: PhotoKind; path: string; price?: number | null };

/** Bookings whose older-app 報價 has been given to one of their uploads this launch. */
const legacyQuoteGiven = new Set<string>();

/**
 * An upload queued by an app from before 報價 by photo has no price, while
 * its booking's single 報價 (`quote`) has nowhere else to go now: give it to
 * the booking's first 參考作品, null to the rest (and to every upload when an
 * earlier photo is already on the booking). Changes the payload, saved with the outbox.
 */
export function adoptLegacyQuote(payload: PhotoPayload): void {
  const legacy = (payload.apt as Appointment & { quote?: number }).quote;
  if (payload.price !== undefined || payload.kind !== 'reference' || legacy == null) return;
  // The cache may not hold the booking yet at the first launch after an upgrade
  const cached = findCachedAppointment(payload.apt.id);
  const earlier = [...(cached ? photosOf(cached, 'reference') : []), ...photosOf(payload.apt, 'reference')]
    .filter((p) => p !== payload.path);
  payload.price = earlier.length === 0 && !legacyQuoteGiven.has(payload.apt.id) ? legacy : null;
  legacyQuoteGiven.add(payload.apt.id);
}

const sendPhotoAdd = defineWrite<PhotoPayload>('addAppointmentPhoto', {
  restore: (payload) => {
    adoptLegacyQuote(payload);
    const { apt, kind, path, price } = payload;
    setPendingPhoto(apt.id, kind, path, 'add', price);
  },
  run: async ({ apt, kind, path, price }) => {
    try {
      const realId = await sheetId(apt.id, true);
      // A new booking's 報價 has no other copy, so a dropped upload is tried again
      const base64 = await readPendingPhoto(path);
      await retryOnce(() => addAppointmentPhoto(realId, kind, path, base64, price));
      markPhotoUploaded(path);
      settlePhoto(path, 'add');
    } catch (e) {
      if (e instanceof AuthError) throw e;
      undoPhoto(path, 'add');
      discardPhoto(path);
      if (e !== CREATE_FAILED) reportFailure('上傳相片', apt, e);
    }
  },
});

const sendPhotoRemove = defineWrite<PhotoPayload>('removeAppointmentPhoto', {
  restore: ({ apt, kind, path }) => setPendingPhoto(apt.id, kind, path, 'remove', undefined, apt),
  run: async ({ apt, kind, path }) => {
    try {
      await removeAppointmentPhoto(await sheetId(apt.id, true), kind, path);
      discardPhoto(path);
      settlePhoto(path, 'remove');
    } catch (e) {
      if (e instanceof AuthError) throw e;
      undoPhoto(path, 'remove');
      // Back on the booking, so a form sends its 報價 again
      removedHere.delete(path);
      if (e !== CREATE_FAILED) reportFailure('移除相片', apt, e);
    }
  },
});

/**
 * Attach photos already saved on the device (see photoFiles). Like a booking
 * save they show at once and upload in the background, behind the booking's
 * own create; a failed upload is undone and reported.
 */
/** `prices`: a new booking's 報價, one per path, uploaded with each photo. */
export function addPhotos(
  apt: Appointment,
  kind: PhotoKind,
  paths: string[],
  prices: (number | null)[] = []
): void {
  paths.forEach((path, i) => {
    setPendingPhoto(apt.id, kind, path, 'add', prices[i]);
    sendPhotoAdd({ apt, kind, path, price: prices[i] ?? null });
  });
}

/** Photos removed on this phone this launch, so a form drops their typed 報價. */
const removedHere = new Set<string>();

export function wasRemovedHere(path: string): boolean {
  return removedHere.has(path);
}

/** Take a photo off a booking and move its file to Drive's trash, in the background. */
export function removePhoto(apt: Appointment, kind: PhotoKind, path: string): void {
  removedHere.add(path);
  setPendingPhoto(apt.id, kind, path, 'remove', undefined, apt);
  sendPhotoRemove({ apt, kind, path });
  hapticWarning();
}

/**
 * Create a booking, or edit `before`. Returns at once with the booking as it
 * will be saved; the write itself runs in the background.
 */
export function saveAppointment(input: UpdateAppointmentInput, before?: Appointment): Appointment {
  // A new booking's 預約ID is chosen here, not by Apps Script, so a create sent
  // twice (see writeQueue) finds the row it already made instead of adding another
  // The booking as cached now (a reload may have changed it since the form
  // opened), so a failed save goes back to it, 報價 included
  if (before) before = findCachedAppointment(before.id) ?? before;
  const id = before ? (realIds.get(before.id) ?? before.id) : randomId();
  const payload = {
    id,
    input,
    local: localAppointment(id, input, before),
    before,
    writeId: before ? randomId() : undefined,
  };
  showSave(payload);
  sendSave(payload);
  return payload.local;
}

/** Delete a booking: it disappears at once, and comes back if the delete fails. */
export function removeAppointment(apt: Appointment): void {
  const id = realIds.get(apt.id) ?? apt.id;
  setPendingAppointment(id, null);
  sendDelete({ id, apt });
  hapticWarning();
}

/**
 * The booking as it is in the sheet, as save input: updateAppointment
 * rewrites every column, and unlike the forms this keeps an older row's
 * Duration as it was.
 */
function inputAsIs(apt: Appointment): UpdateAppointmentInput {
  return {
    customerName: apt.customerName,
    date: apt.date,
    time: apt.time,
    service: apt.service as ServiceType,
    notes: apt.notes,
    durationMinutes: apt.durationMinutes,
    handOrFoot: apt.handOrFoot as UpdateAppointmentInput['handOrFoot'],
    price: apt.price,
    // No quotes: the script leaves the 相片 tab's prices alone
    deposit: apt.deposit,
    complexDesign: apt.complexDesign as UpdateAppointmentInput['complexDesign'],
    removal: apt.removal,
    extension: apt.extension as UpdateAppointmentInput['extension'],
  };
}

/** Change only a booking's 狀態 (e.g. No show from a long-press menu). */
export function saveAppointmentStatus(apt: Appointment, status: AppointmentStatus): void {
  saveAppointment({ ...inputAsIs(apt), status }, apt);
}

/**
 * Mark (or unmark) a booking as 保留訂金: the customer keeps its paid deposit
 * for their next booking. Only 訂金處理 changes; 狀態 is left as it is.
 */
export function saveKeepDeposit(apt: Appointment, keepDeposit: boolean): Appointment {
  return saveAppointment({ ...inputAsIs(apt), keepDeposit }, apt);
}

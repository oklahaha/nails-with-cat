/**
 * Saves and deletes that don't make the user wait for Apps Script, which
 * takes several seconds per write: the change shows in every cached list at
 * once, the form closes, and the write is sent in the background. Writes run
 * one at a time in the order they were made, so an edit or delete of a
 * booking that's still being created waits for its real 預約ID (the queue is
 * shared with customer writes, see writeQueue). A failed write is undone in
 * the lists and reported with an alert.
 */
import { setPendingAppointment, settleAppointment } from '@/hooks/useAppointments';
import { syncUpcoming } from '@/hooks/useUpcomingSync';
import { findCachedCustomer } from '@/hooks/useCustomers';
import { enqueueWrite } from '@/hooks/writeQueue';
import {
  createAppointment,
  deleteAppointment,
  updateAppointment,
} from '@/services/appointmentsApi';
import type { Appointment, UpdateAppointmentInput } from '@/types/appointment';
import { showAlert } from '@/utils/alert';
import { appointmentTitle } from '@/utils/appointmentTitle';
import { minutesToTime, timeToMinutes } from '@/utils/dates';
import { formatDateHeader } from '@/utils/groupByDate';

/** Ids given to new bookings until Apps Script returns their 預約ID. */
const LOCAL_ID_PREFIX = 'local-';

/** Local id → the 預約ID Apps Script created, or null if creating it failed. */
const createdIds = new Map<string, Promise<string | null>>();
/** The same, once known, for screens still holding a booking by its local id. */
const realIds = new Map<string, string>();

/** The 預約ID to send for `id`, which may be a booking still being created. */
async function sheetId(id: string): Promise<string> {
  const created = createdIds.get(id);
  if (!created) return id;
  const real = await created;
  if (real == null) throw new Error('此預約未能新增');
  return real;
}

/**
 * Alert the user to a failed write. The widget and reminders may have picked
 * up the booking from the cache while it was pending, so resync them too
 * (successful writes do that through onAppointmentsChanged).
 */
function reportFailure(action: string, apt: Appointment, e: unknown): void {
  void syncUpcoming();
  const what = `${appointmentTitle(apt)} ${formatDateHeader(apt.date)} ${apt.time}`;
  showAlert(`${action}失敗`, `${what}\n${e instanceof Error ? e.message : '未知錯誤'}`);
}

/** How the booking will look once saved, built locally from the form's input. */
function localAppointment(id: string, input: UpdateAppointmentInput, before?: Appointment) {
  const name = input.customerName.trim();
  const phone =
    before && before.customerName === name ? before.phone : findCachedCustomer({ name })?.phone;
  const isSpecial = input.service === '特別事項';
  return {
    ...before,
    ...input,
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

/**
 * Create a booking, or edit `before`. Returns at once with the booking as it
 * will be saved; the write itself runs in the background.
 */
export function saveAppointment(input: UpdateAppointmentInput, before?: Appointment): Appointment {
  const id = before ? (realIds.get(before.id) ?? before.id) : `${LOCAL_ID_PREFIX}${Date.now()}`;
  const local = localAppointment(id, input, before);
  setPendingAppointment(id, local);

  if (before) {
    enqueueWrite(async () => {
      try {
        const realId = await sheetId(id);
        const saved = await updateAppointment(realId, input);
        settleAppointment(id, { ...local, ...saved, id: realId, phone: saved.phone || local.phone });
      } catch (e) {
        settleAppointment(id, { ...before, id });
        reportFailure('儲存', local, e);
      }
    });
  } else {
    let resolveId!: (real: string | null) => void;
    createdIds.set(id, new Promise((resolve) => (resolveId = resolve)));
    enqueueWrite(async () => {
      try {
        const saved = await createAppointment(input);
        realIds.set(id, saved.id);
        resolveId(saved.id);
        settleAppointment(id, { ...local, ...saved, phone: saved.phone || local.phone });
      } catch (e) {
        resolveId(null);
        settleAppointment(id, null);
        reportFailure('新增', local, e);
      }
    });
  }
  return local;
}

/** Delete a booking: it disappears at once, and comes back if the delete fails. */
export function removeAppointment(apt: Appointment): void {
  const id = realIds.get(apt.id) ?? apt.id;
  setPendingAppointment(id, null);
  enqueueWrite(async () => {
    try {
      const realId = await sheetId(id);
      await deleteAppointment(realId);
      settleAppointment(realId, null);
      if (realId !== id) settleAppointment(id, null);
    } catch (e) {
      settleAppointment(id, { ...apt, id });
      reportFailure('刪除', apt, e);
    }
  });
}

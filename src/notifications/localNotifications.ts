/**
 * The notifications the phone schedules for itself from the upcoming
 * bookings (no server involved): a reminder an hour before each booking,
 * and a summary of the day's bookings each morning. notifications.ts
 * replaces every scheduled one with this list on each sync.
 */
import type { Appointment } from '@/types/appointment';
import { parseIsoDate, timeToMinutes } from '@/utils/dates';
import { isCustomerBooking } from '@/utils/stats';

/** Reminders go off this long before a booking starts. */
export const REMINDER_LEAD_MINUTES = 60;

/** When the daily summary goes off (HH:mm). */
export const SUMMARY_TIME = '09:00';

/**
 * iOS keeps at most 64 pending local notifications per app and drops the
 * rest, so only the earliest ones are scheduled; later ones get their turn
 * on a later sync.
 */
const MAX_SCHEDULED = 60;

/** Android channels; push messages from Apps Script use `changes`. */
export const CHANNEL_REMINDERS = 'reminders';
export const CHANNEL_CHANGES = 'changes';

/** Sent along with notifications that are about one booking, to open it on tap. */
export type AppointmentNotificationData = { appointmentId?: string };

export type LocalNotification = {
  at: Date;
  title: string;
  body: string;
  data: AppointmentNotificationData;
};

function at(date: string, time: string): Date {
  const result = parseIsoDate(date);
  result.setMinutes(timeToMinutes(time));
  return result;
}

/**
 * Everything to schedule after `now`, earliest first. `appointments` should
 * cover today onwards; 特別事項 rows are skipped.
 */
export function buildLocalNotifications(
  appointments: Appointment[],
  now: Date = new Date()
): LocalNotification[] {
  const bookings = appointments
    .filter(isCustomerBooking)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

  const out: LocalNotification[] = [];

  for (const apt of bookings) {
    const start = at(apt.date, apt.time);
    out.push({
      at: new Date(start.getTime() - REMINDER_LEAD_MINUTES * 60_000),
      title: `一小時後：${apt.customerName}`,
      body: `${apt.time} ${apt.service}${apt.handOrFoot ? `（${apt.handOrFoot}）` : ''}`,
      data: { appointmentId: apt.id },
    });
  }

  const days = [...new Set(bookings.map((apt) => apt.date))];
  for (const day of days) {
    const dayBookings = bookings.filter((apt) => apt.date === day);
    out.push({
      at: at(day, SUMMARY_TIME),
      title: `今日有 ${dayBookings.length} 個預約`,
      body: dayBookings.map((apt) => `${apt.time} ${apt.customerName}`).join('、'),
      data: {},
    });
  }

  return out
    .filter((n) => n.at > now)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_SCHEDULED);
}


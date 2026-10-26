/**
 * Turns loaded appointments into timeline entries for TodayWidget.
 *
 * A widget can only show props the app gave it ahead of time, so instead of
 * one snapshot this precomputes what the widget should show at every moment
 * its content changes: midnight (a new day's count) and the start of each
 * booking (the next one moves on). iOS switches entries at those times.
 */
import { serviceColor } from '@/constants/services';
import type { Appointment } from '@/types/appointment';
import { appointmentTitle } from '@/utils/appointmentTitle';
import { addDays, parseIsoDate, timeToMinutes, WEEKDAY_LABELS } from '@/utils/dates';
import { isCustomerBooking } from '@/utils/stats';

import type { TodayWidgetAppointment, TodayWidgetProps } from './TodayWidget';

/** Days covered by the timeline; load at least a few days more, for `next`. */
export const TIMELINE_DAYS = 7;

export type TodayWidgetTimelineEntry = { date: Date; props: TodayWidgetProps };

function startOf(apt: Appointment): Date {
  const date = parseIsoDate(apt.date);
  date.setMinutes(timeToMinutes(apt.time));
  return date;
}

function toWidgetAppointment(apt: Appointment): TodayWidgetAppointment {
  return {
    time: apt.time,
    title: appointmentTitle(apt),
    service: apt.service,
    color: serviceColor(apt.service),
  };
}

/** e.g. 10月26日（一） */
function dayLabel(iso: string): string {
  const date = parseIsoDate(iso);
  return `${date.getMonth() + 1}月${date.getDate()}日（${WEEKDAY_LABELS[date.getDay()]}）`;
}

/**
 * Entries from `now` through the end of day `TIMELINE_DAYS - 1`.
 * `appointments` should cover `today` onwards; 特別事項 rows are skipped.
 */
export function buildTodayWidgetTimeline(
  appointments: Appointment[],
  today: string,
  now: Date = new Date()
): TodayWidgetTimelineEntry[] {
  const bookings = appointments
    .filter(isCustomerBooking)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

  const entries: TodayWidgetTimelineEntry[] = [];
  for (let d = 0; d < TIMELINE_DAYS; d++) {
    const day = addDays(today, d);
    const dayBookings = bookings.filter((apt) => apt.date === day);

    // Today starts now; later days at midnight. Then one entry per start time.
    const changes = [d === 0 ? now : parseIsoDate(day)];
    for (const apt of dayBookings) {
      const start = startOf(apt);
      if (start > changes[changes.length - 1]) changes.push(start);
    }

    for (const at of changes) {
      // A booking that starts exactly now is no longer "next"
      const nextIndex = bookings.findIndex((apt) => startOf(apt) > at);
      const next = nextIndex === -1 ? undefined : bookings[nextIndex];
      const laterToday = next?.date === day ? bookings.slice(nextIndex + 1) : [];

      entries.push({
        date: at,
        props: {
          dateLabel: dayLabel(day),
          todayCount: dayBookings.length,
          next: next
            ? {
                ...toWidgetAppointment(next),
                dayLabel:
                  next.date === day ? '' : next.date === addDays(day, 1) ? '明天' : dayLabel(next.date),
              }
            : null,
          laterToday: laterToday
            .filter((apt) => apt.date === day)
            .slice(0, 2)
            .map(toWidgetAppointment),
        },
      });
    }
  }
  return entries;
}

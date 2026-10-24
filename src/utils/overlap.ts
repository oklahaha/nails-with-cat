import type { Appointment } from '@/types/appointment';
import { appointmentTitle } from '@/utils/appointmentTitle';
import { timeToMinutes } from '@/utils/dates';

/** Length given to zero-length rows (e.g. 特別事項 with no end), so they still block their half hour. */
const MIN_SPAN = 30;

/** Start/end minutes of a booking; zero-length rows block their half hour. */
export function bookingSpan(
  apt: Pick<Appointment, 'time' | 'endTime' | 'durationMinutes'>
): [number, number] {
  const start = timeToMinutes(apt.time);
  let end = apt.endTime ? timeToMinutes(apt.endTime) : NaN;
  if (!(end > start) && apt.durationMinutes) end = start + apt.durationMinutes;
  if (!(end > start)) end = start + MIN_SPAN;
  return [start, end];
}

/** The bookings that overlap `time` (HH:mm) lasting `durationMinutes`. */
export function findOverlaps(
  bookings: Appointment[],
  time: string,
  durationMinutes: number | undefined
): Appointment[] {
  const [start, end] = bookingSpan({ time, durationMinutes });
  return bookings.filter((apt) => {
    const [aptStart, aptEnd] = bookingSpan(apt);
    return start < aptEnd && aptStart < end;
  });
}

/** One line per overlapping booking, e.g. "10:00–11:00 陳小姐". */
export function describeOverlaps(overlaps: Appointment[]): string {
  return overlaps
    .map((apt) => `${apt.time}${apt.endTime ? `–${apt.endTime}` : ''} ${appointmentTitle(apt)}`)
    .join('\n');
}

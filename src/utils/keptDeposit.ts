import { NO_SHOW, type Appointment } from '@/types/appointment';

/**
 * The customer's previous booking, if it kept its deposit (保留訂金), for the
 * reminder on their next one. `history` is the customer's bookings (any
 * order); the previous one is the latest before `date` / `time`, skipping
 * No show bookings (not a visit) and `excludeId` (the booking being shown).
 */
export function previousKeptDeposit(
  history: Appointment[],
  date: string,
  time: string,
  excludeId?: string
): Appointment | undefined {
  const at = `${date} ${time}`;
  let previous: Appointment | undefined;
  for (const apt of history) {
    if (apt.id === excludeId || apt.status === NO_SHOW || apt.service === '特別事項') continue;
    const when = `${apt.date} ${apt.time}`;
    if (when >= at) continue;
    if (!previous || when > `${previous.date} ${previous.time}`) previous = apt;
  }
  return previous?.keepDeposit ? previous : undefined;
}

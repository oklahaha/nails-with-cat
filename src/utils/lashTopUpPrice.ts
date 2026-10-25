/**
 * Default 收費 for 補眼睫毛 (lash top-up), from how recently the customer had
 * a full set of lashes before the booking date:
 * - within 5 days → $0
 * - within 14 days → $214
 * - otherwise → $428
 */
import type { Appointment } from '@/types/appointment';
import { addDays } from '@/utils/dates';

/** Services that give a full set of lashes. */
const LASH_SERVICES: readonly string[] = ['眼睫毛', '整甲 + 眼睫毛'];

const TIERS = [
  { withinDays: 5, price: 0 },
  { withinDays: 14, price: 214 },
] as const;

const FULL_PRICE = 428;

/** How far back `history` must reach for lashTopUpPrice. */
export const LASH_TOP_UP_LOOKBACK_DAYS = 14;

/**
 * `history` should cover LASH_TOP_UP_LOOKBACK_DAYS before `date` up to `date`.
 * Lash bookings on the same day count, so a top-up booked straight after
 * a set is free. Pass `excludeId` to ignore the booking being edited.
 */
export function lashTopUpPrice(
  history: Appointment[],
  customerName: string,
  date: string,
  excludeId?: string
): number {
  const name = customerName.trim();
  const lashDates = history
    .filter(
      (apt) =>
        apt.id !== excludeId &&
        apt.customerName.trim() === name &&
        LASH_SERVICES.includes(apt.service) &&
        apt.date <= date
    )
    .map((apt) => apt.date);

  for (const tier of TIERS) {
    const since = addDays(date, -tier.withinDays);
    if (lashDates.some((d) => d >= since)) return tier.price;
  }
  return FULL_PRICE;
}

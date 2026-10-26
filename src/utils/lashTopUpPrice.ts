/**
 * Default 收費 for 補眼睫毛 (lash top-up), from how recently the customer had
 * a full set of lashes before the booking date:
 * - within 5 days → $0
 * - within 14 days → $214
 * - otherwise → $428
 */
import type { Appointment } from '@/types/appointment';
import { addDays, formatShortDate, parseIsoDate } from '@/utils/dates';

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
 * The customer's latest full lash set on or before `date`, or undefined when
 * there's none in `history`. Same arguments as lashTopUpPrice.
 */
export function lastLashSetDate(
  history: Appointment[],
  customerName: string,
  date: string,
  excludeId?: string
): string | undefined {
  const name = customerName.trim();
  let latest: string | undefined;
  for (const apt of history) {
    if (
      apt.id !== excludeId &&
      apt.customerName.trim() === name &&
      LASH_SERVICES.includes(apt.service) &&
      apt.date <= date &&
      (latest == null || apt.date > latest)
    ) {
      latest = apt.date;
    }
  }
  return latest;
}

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
  const last = lastLashSetDate(history, customerName, date, excludeId);
  if (last == null) return FULL_PRICE;
  for (const tier of TIERS) {
    if (last >= addDays(date, -tier.withinDays)) return tier.price;
  }
  return FULL_PRICE;
}

/** Footer under 收費 explaining the 補眼睫毛 price, e.g. 上次做眼睫毛：2026年10月21日（三），5 日前 */
export function lastLashSetHint(lastDate: string | undefined, date: string): string {
  if (lastDate == null) return `過去 ${LASH_TOP_UP_LOOKBACK_DAYS} 日冇做過眼睫毛`;
  const days = Math.round(
    (parseIsoDate(date).getTime() - parseIsoDate(lastDate).getTime()) / 86_400_000
  );
  return `上次做眼睫毛：${formatShortDate(lastDate)}，${days === 0 ? '同日' : `${days} 日前`}`;
}

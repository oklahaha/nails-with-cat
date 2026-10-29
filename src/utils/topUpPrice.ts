/**
 * Default 收費 for the top-up services, from how recently the customer had
 * the full set they top up, before the booking date:
 * - 補眼睫毛 (after 眼睫毛): within 5 days → $0, within 14 days → $214, else $428
 * - 補甲 (after 整甲): within 5 days → $0, else $30
 */
import { NO_SHOW, type Appointment } from '@/types/appointment';
import { addDays, formatShortDate, parseIsoDate } from '@/utils/dates';

export type TopUpRule = {
  /** Services that give the full set, e.g. 眼睫毛 and 整甲 + 眼睫毛. */
  setServices: readonly string[];
  /** What the set is called in the footer under 收費. */
  setLabel: string;
  /** Checked in order; the first one the last set falls within wins. */
  tiers: readonly { withinDays: number; price: number }[];
  fullPrice: number;
  /** How far back `history` must reach: the widest tier. */
  lookbackDays: number;
};

const TOP_UP_RULES: Record<string, TopUpRule> = {
  補眼睫毛: {
    setServices: ['眼睫毛', '整甲 + 眼睫毛'],
    setLabel: '眼睫毛',
    tiers: [
      { withinDays: 5, price: 0 },
      { withinDays: 14, price: 214 },
    ],
    fullPrice: 428,
    lookbackDays: 14,
  },
  補甲: {
    setServices: ['整甲', '整甲 + 眼睫毛'],
    setLabel: '整甲',
    tiers: [{ withinDays: 5, price: 0 }],
    fullPrice: 30,
    lookbackDays: 5,
  },
};

/** The rule for a top-up service, or undefined for every other service. */
export function topUpRuleFor(service: string): TopUpRule | undefined {
  return TOP_UP_RULES[service];
}

/**
 * The customer's latest full set on or before `date`, or undefined when
 * there's none in `history`. Same arguments as topUpPrice.
 */
export function lastSetDate(
  rule: TopUpRule,
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
      apt.status !== NO_SHOW &&
      apt.customerName.trim() === name &&
      rule.setServices.includes(apt.service) &&
      apt.date <= date &&
      (latest == null || apt.date > latest)
    ) {
      latest = apt.date;
    }
  }
  return latest;
}

/**
 * `history` should cover `rule.lookbackDays` before `date` up to `date`.
 * Sets on the same day count, so a top-up booked straight after a set is
 * free. Pass `excludeId` to ignore the booking being edited.
 */
export function topUpPrice(
  rule: TopUpRule,
  history: Appointment[],
  customerName: string,
  date: string,
  excludeId?: string
): number {
  const last = lastSetDate(rule, history, customerName, date, excludeId);
  if (last == null) return rule.fullPrice;
  for (const tier of rule.tiers) {
    if (last >= addDays(date, -tier.withinDays)) return tier.price;
  }
  return rule.fullPrice;
}

/** Footer under 收費 explaining the price, e.g. 上次做眼睫毛：2026年10月21日（三），5 日前 */
export function lastSetHint(rule: TopUpRule, lastDate: string | undefined, date: string): string {
  if (lastDate == null) return `過去 ${rule.lookbackDays} 日冇做過${rule.setLabel}`;
  const days = Math.round(
    (parseIsoDate(date).getTime() - parseIsoDate(lastDate).getTime()) / 86_400_000
  );
  return `上次做${rule.setLabel}：${formatShortDate(lastDate)}，${days === 0 ? '同日' : `${days} 日前`}`;
}

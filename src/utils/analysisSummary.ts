/**
 * Turns the 分析摘要 rows (analysis/src/analysis/summary.py) into what the
 * 統計 → 洞察 view draws. Pure functions, so the rules are tested here and
 * the SwiftUI view only lays them out.
 */
import type { AnalyticsSummaryRow, CustomerAnalytics, CustomerInsight } from '@/types/customerAnalytics';
import type { Customer } from '@/types/customer';
import { addMonths } from '@/utils/dates';

/** Services in the order the 洞察 view lists them (the full sets). */
export const FULL_SET_ORDER = ['整甲', '眼睫毛', '整甲 + 眼睫毛'] as const;
/** Groups resting on fewer customers than this get a 人數少 note. */
export const SMALL_GROUP = 30;
/** Months with fewer open days than this (e.g. the month just started) are left out. */
const MIN_OPEN_DAYS = 8;
/** Next services below this share are folded into 其他. */
const MIN_NEXT_SHARE = 0.04;

export type RangeItem = {
  label: string;
  value: number;
  low: number | null;
  high: number | null;
  n: number;
};

function rowsFor(analytics: CustomerAnalytics, item: string): AnalyticsSummaryRow[] {
  return (analytics.summary ?? []).filter((r) => r.item === item && r.value != null);
}

function toRange(r: AnalyticsSummaryRow): RangeItem {
  return { label: r.group, value: r.value ?? 0, low: r.low, high: r.high, n: r.n ?? 0 };
}

function byServiceOrder(a: { label: string }, b: { label: string }): number {
  const ia = FULL_SET_ORDER.indexOf(a.label as (typeof FULL_SET_ORDER)[number]);
  const ib = FULL_SET_ORDER.indexOf(b.label as (typeof FULL_SET_ORDER)[number]);
  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
}

/**
 * The analysis's findings in plain language, in its order: generic, so any
 * new analysis that writes a finding shows up without an app update.
 */
export function findings(analytics: CustomerAnalytics): { topic: string; text: string }[] {
  return (analytics.summary ?? [])
    .filter((r) => r.item === 'finding' && r.text)
    .sort((a, b) => (a.value ?? 0) - (b.value ?? 0))
    .map((r) => ({ topic: r.group, text: r.text ?? '' }));
}

/** True when the run included a 分析摘要 tab worth a 洞察 view. */
export function hasSummary(analytics: CustomerAnalytics): boolean {
  return (analytics.summary ?? []).some((r) => r.value != null);
}

export type VisitRhythm = RangeItem & {
  /** Share of visits after which the customer never came back (0–1); null if unknown */
  neverReturn: number | null;
};

/** Median days between visits per full set, with the share that never come back. */
export function visitRhythm(analytics: CustomerAnalytics): VisitRhythm[] {
  const never = new Map(rowsFor(analytics, 'never_return').map((r) => [r.group, r.value]));
  return rowsFor(analytics, 'gap_median')
    .map((r) => ({ ...toRange(r), neverReturn: never.get(r.group) ?? null }))
    .sort(byServiceOrder);
}

export type NewCustomerReturn = {
  overall: RangeItem | null;
  byService: RangeItem[];
  bySource: RangeItem[];
};

/** Share of new customers back within 60 days: overall, by first service and by 來源. */
export function newCustomerReturn(analytics: CustomerAnalytics): NewCustomerReturn {
  const rows = rowsFor(analytics, 'new_return').map(toRange);
  return {
    overall: rows.find((r) => r.label === '全部') ?? null,
    byService: rows.filter((r) => r.label !== '全部').sort(byServiceOrder),
    bySource: rowsFor(analytics, 'new_return_source')
      .map(toRange)
      .sort((a, b) => b.value - a.value),
  };
}

/** Share of the last 12 months' revenue from the top 10 / 20 / 50% of customers. */
export function revenueShares(analytics: CustomerAnalytics): { label: string; share: number; customers: number }[] {
  return rowsFor(analytics, 'revenue_share').map((r) => ({
    label: r.group,
    share: r.value ?? 0,
    customers: r.n ?? 0,
  }));
}

export type NextServiceMix = {
  from: string;
  /** Visits after which the next one was counted */
  total: number;
  /** Largest first; small ones folded into 其他 */
  next: { service: string; share: number }[];
};

/** What customers book next after each service. */
export function nextServices(analytics: CustomerAnalytics): NextServiceMix[] {
  const byFrom = new Map<string, NextServiceMix>();
  for (const r of rowsFor(analytics, 'next_service')) {
    const mix = byFrom.get(r.group) ?? { from: r.group, total: r.n ?? 0, next: [] };
    mix.next.push({ service: r.subgroup, share: r.value ?? 0 });
    byFrom.set(r.group, mix);
  }
  return [...byFrom.values()]
    .map((mix) => {
      const sorted = [...mix.next].sort((a, b) => b.share - a.share);
      const kept = sorted.filter((n) => n.share >= MIN_NEXT_SHARE);
      const other = sorted.filter((n) => n.share < MIN_NEXT_SHARE).reduce((sum, n) => sum + n.share, 0);
      return { ...mix, next: other > 0 ? [...kept, { service: '其他', share: other }] : kept };
    })
    .sort((a, b) => byServiceOrder({ label: a.from }, { label: b.from }));
}

export type WorkloadMonth = {
  /** YYYY-MM */
  month: string;
  /** e.g. 10月 */
  label: string;
  /** Booked hours per open day */
  hours: number;
  /** Share of open days with two bookings at once (0–1) */
  twoAtOnce: number;
  openDays: number;
};

/** Booked hours per open day by month, oldest first, skipping months with too few open days. */
export function workload(analytics: CustomerAnalytics): WorkloadMonth[] {
  const overlap = new Map(rowsFor(analytics, 'two_at_once').map((r) => [r.group, r.value ?? 0]));
  return rowsFor(analytics, 'workload')
    .filter((r) => (r.n ?? 0) >= MIN_OPEN_DAYS)
    .map((r) => ({
      month: r.group,
      label: `${Number(r.group.slice(5))}月`,
      hours: r.value ?? 0,
      twoAtOnce: overlap.get(r.group) ?? 0,
      openDays: r.n ?? 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export type ModelCheck = {
  /** Of those the model expected back, the share who did return within 60 days */
  expectedBack: number;
  expectedBackCount: number;
  /** Of those it didn't expect back, the share who returned anyway */
  notExpectedBack: number;
  notExpectedBackCount: number;
};

/** How the return model did on months it hadn't seen; null without the numbers. */
export function modelCheck(analytics: CustomerAnalytics): ModelCheck | null {
  const rows = new Map(rowsFor(analytics, 'model_check').map((r) => [r.group, r]));
  const back = rows.get('預計會回來');
  const notBack = rows.get('預計不會回來');
  if (!back || !notBack) return null;
  return {
    expectedBack: back.value ?? 0,
    expectedBackCount: back.n ?? 0,
    notExpectedBack: notBack.value ?? 0,
    notExpectedBackCount: notBack.n ?? 0,
  };
}

/**
 * Customers expected back within 60 days: the sum of everyone's P(return),
 * minus those already booked (they're coming anyway, and counted on the
 * timetable).
 */
export function expectedReturns(analytics: CustomerAnalytics): number {
  return analytics.customers.reduce(
    (sum, c) => sum + (c.hasUpcoming ? 0 : (c.pReturn60d ?? 0)),
    0
  );
}

/** New customers (加入日期 from the start of the month `months` back) per 來源, most first, and how many have none. */
export function newCustomerSources(
  customers: Customer[],
  today: string,
  months = 12
): { sources: { source: string; customers: number }[]; unknown: number } {
  const from = addMonths(today, -months);
  const counts = new Map<string, number>();
  let unknown = 0;
  for (const c of customers) {
    if (!c.joinedDate || c.joinedDate < from || c.joinedDate > today) continue;
    if (c.source) counts.set(c.source, (counts.get(c.source) ?? 0) + 1);
    else unknown += 1;
  }
  return {
    sources: [...counts.entries()]
      .map(([source, n]) => ({ source, customers: n }))
      .sort((a, b) => b.customers - a.customers),
    unknown,
  };
}

/** The analysis row for one customer: by 顧客ID, or by name for customers without one. */
export function insightFor(
  analytics: CustomerAnalytics,
  customer: Pick<Customer, 'id' | 'name'>
): CustomerInsight | undefined {
  if (customer.id) return analytics.customers.find((c) => c.customerId === customer.id);
  return analytics.customers.find((c) => c.name === customer.name);
}

/** 0.364, 0.29, 0.44 → 36%（29–44%）; the interval only when known. */
export function formatRate(item: Pick<RangeItem, 'value' | 'low' | 'high'>): string {
  const pct = (x: number) => Math.round(x * 100);
  const base = `${pct(item.value)}%`;
  return item.low != null && item.high != null ? `${base}（${pct(item.low)}–${pct(item.high)}%）` : base;
}

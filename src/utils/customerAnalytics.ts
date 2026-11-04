/**
 * Turns the nightly analysis results into the 統計 lists. The results are up
 * to a day old, so each list checks today's bookings: a customer who has
 * booked or visited since the run shouldn't be chased.
 */
import type { Appointment } from '@/types/appointment';
import type { Customer } from '@/types/customer';
import type {
  CustomerAnalytics,
  CustomerInsight,
  ForecastWeek,
} from '@/types/customerAnalytics';
import { addDays, startOfWeek } from '@/utils/dates';
import { daysBetween, isCustomerBooking } from '@/utils/stats';

/** Older results than this aren't shown; 統計 goes back to the 久未回來 list. */
const MAX_AGE_DAYS = 7;
/**
 * 快將回來 looks this far ahead. The model's expected return is rarely under
 * two weeks away, since a customer's gaps vary a lot, so a shorter window
 * would stay empty.
 */
const DUE_SOON_DAYS = 21;
/** Segments worth a message. The others left long ago or came only once. */
const WORTH_CONTACTING = new Set(['活躍熟客', '疏遠中']);

/** What each segment means, shown under its name. */
const SEGMENT_DESCRIPTIONS: Record<string, string> = {
  活躍熟客: '最近常來，節奏穩定',
  疏遠中: '一年內有來，但間隔長而不定',
  新客: '60 日內第一次來',
  睫毛試客: '想試眼睫毛，未必會成為熟客',
  流失甲客: '曾經常來做甲，超過一年未見',
  流失睫毛客: '曾經常來做眼睫毛，超過一年未見',
  一次客: '只來過一次，已有一段時間',
};

/** True when there are results recent enough to show. */
export function hasFreshAnalytics(
  analytics: CustomerAnalytics | null,
  today: string
): analytics is CustomerAnalytics {
  if (!analytics?.updatedAt || analytics.customers.length === 0) return false;
  return daysBetween(analytics.updatedAt.slice(0, 10), today) <= MAX_AGE_DAYS;
}

export type InsightRow = CustomerInsight & { phone?: string };

/**
 * Rows with the customer's current name and phone (the 顧客 list is newer than
 * the run), minus those who have booked or visited since it. Matched by
 * 顧客ID, since names can change.
 */
function currentRows(
  rows: CustomerInsight[],
  customers: Customer[],
  appointments: Appointment[]
): InsightRow[] {
  const byId = new Map(customers.filter((c) => c.id).map((c) => [c.id, c]));
  const latest = new Map<string, string>();
  for (const apt of appointments) {
    if (!isCustomerBooking(apt)) continue;
    const seen = latest.get(apt.customerName);
    if (!seen || apt.date > seen) latest.set(apt.customerName, apt.date);
  }
  const out: InsightRow[] = [];
  for (const row of rows) {
    const customer = byId.get(row.customerId);
    const name = customer?.name ?? row.name;
    const last = latest.get(name);
    // Any later date is a visit or a booking made since the run saw lastVisit
    if (last && last > row.lastVisit) continue;
    out.push({ ...row, name, phone: customer?.phone || undefined });
  }
  return out;
}

/**
 * 可能流失: customers worth a message who probably won't return by themselves,
 * those with the most future value first.
 */
export function atRiskCustomers(
  analytics: CustomerAnalytics,
  customers: Customer[],
  appointments: Appointment[]
): InsightRow[] {
  const rows = analytics.customers.filter((c) => c.churn && WORTH_CONTACTING.has(c.segment));
  return currentRows(rows, customers, appointments).sort((a, b) => b.clv12m - a.clv12m);
}

/**
 * 快將回來: customers expected back soon with nothing booked, a chance to
 * message them first. Soonest first.
 */
export function dueSoonCustomers(
  analytics: CustomerAnalytics,
  customers: Customer[],
  appointments: Appointment[],
  today: string
): InsightRow[] {
  const rows = analytics.customers.filter(
    (c) =>
      !c.churn &&
      c.expectedNextVisit != null &&
      daysBetween(today, c.expectedNextVisit) <= DUE_SOON_DAYS
  );
  return currentRows(rows, customers, appointments).sort((a, b) =>
    (a.expectedNextVisit ?? '').localeCompare(b.expectedNextVisit ?? '')
  );
}

export type SegmentSummary = {
  segment: string;
  description: string;
  customers: number;
  /** Share of the total 12個月CLV, 0–1 */
  clvShare: number;
};

/** Customers and share of future value per segment, most valuable first. */
export function segmentSummary(analytics: CustomerAnalytics): SegmentSummary[] {
  const total = analytics.customers.reduce((sum, c) => sum + c.clv12m, 0);
  const bySegment = new Map<string, { customers: number; clv: number }>();
  for (const c of analytics.customers) {
    const entry = bySegment.get(c.segment) ?? { customers: 0, clv: 0 };
    entry.customers += 1;
    entry.clv += c.clv12m;
    bySegment.set(c.segment, entry);
  }
  return [...bySegment.entries()]
    .map(([segment, { customers, clv }]) => ({
      segment,
      description: SEGMENT_DESCRIPTIONS[segment] ?? '',
      customers,
      clvShare: total > 0 ? clv / total : 0,
    }))
    .sort((a, b) => b.clvShare - a.clvShare || b.customers - a.customers);
}

/** The first full week after today's, the one worth planning around. */
export function nextForecastWeek(
  forecast: ForecastWeek[],
  today: string
): ForecastWeek | undefined {
  return forecast.find((week) => week.weekStart > today);
}

/**
 * Everyone in a segment, with their current name and phone: highest value
 * first, then (as many have none) most recently seen.
 */
export function segmentCustomers(
  analytics: CustomerAnalytics,
  customers: Customer[],
  segment: string
): InsightRow[] {
  const byId = new Map(customers.filter((c) => c.id).map((c) => [c.id, c]));
  return analytics.customers
    .filter((c) => c.segment === segment)
    .map((row) => {
      const customer = byId.get(row.customerId);
      return { ...row, name: customer?.name ?? row.name, phone: customer?.phone || undefined };
    })
    .sort((a, b) => b.clv12m - a.clv12m || b.lastVisit.localeCompare(a.lastVisit));
}

/** e.g. 上次 9月3日 · 共 12 次 · 已有預約 */
export function insightSummary(row: CustomerInsight): string {
  const [, m, d] = row.lastVisit.split('-').map(Number);
  const parts = [`上次 ${m}月${d}日`, `共 ${row.visits} 次`];
  if (row.hasUpcoming) parts.push('已有預約');
  return parts.join(' · ');
}

/** How many visits count for each bar of the visit-count chart. */
const VISIT_BUCKETS = [
  { label: '1 次', max: 1 },
  { label: '2–3', max: 3 },
  { label: '4–7', max: 7 },
  { label: '8–15', max: 15 },
  { label: '16+', max: Infinity },
];

/** Customers per number of visits, over their whole history. */
export function visitDistribution(
  analytics: CustomerAnalytics
): { label: string; customers: number }[] {
  const counts = VISIT_BUCKETS.map((b) => ({ label: b.label, customers: 0 }));
  for (const c of analytics.customers) {
    const bucket = VISIT_BUCKETS.findIndex((b) => c.visits <= b.max);
    if (bucket >= 0) counts[bucket].customers += 1;
  }
  return counts;
}

/** Height of the forecast's tick, in bookings. */
const FORECAST_TICK = 0.5;

export type ForecastSegment = {
  x: string;
  y: number;
  kind: 'gap' | 'range' | 'tick';
};

/**
 * One week's forecast as stacked bar segments, since Swift Charts stacks bars
 * sharing an x and has no floating bar: an invisible gap up to the 80% range's
 * bottom, the range, and a tick at the forecast itself.
 */
export function forecastSegments(forecast: ForecastWeek[]): ForecastSegment[] {
  return forecast.flatMap((week) => {
    const x = formatWeekLabel(week.weekStart);
    const tickStart = Math.max(week.bookings - FORECAST_TICK / 2, week.bookingsLow);
    const tickEnd = Math.min(tickStart + FORECAST_TICK, week.bookingsHigh);
    return [
      { x, y: week.bookingsLow, kind: 'gap' as const },
      { x, y: tickStart - week.bookingsLow, kind: 'range' as const },
      { x, y: tickEnd - tickStart, kind: 'tick' as const },
      { x, y: week.bookingsHigh - tickEnd, kind: 'range' as const },
    ];
  });
}

/** Bookings per week over the last `weeks` finished Monday-to-Sunday weeks, to compare with the forecast. */
export function recentWeeklyBookings(
  appointments: Appointment[],
  today: string,
  weeks = 8
): number {
  // startOfWeek is a Sunday: on a Sunday, this Monday is six days back
  const sunday = startOfWeek(today);
  const monday = sunday === today ? addDays(today, -6) : addDays(sunday, 1);
  const from = addDays(monday, -7 * weeks);
  const count = appointments.filter(
    (apt) => isCustomerBooking(apt) && apt.date >= from && apt.date < monday
  ).length;
  return count / weeks;
}

/** 0.234 → 23%; — when unknown. */
export function formatPercent(share: number | null): string {
  return share == null ? '—' : `${Math.round(share * 100)}%`;
}

/** YYYY-MM-DD → 11/2, for the forecast chart's labels. */
export function formatWeekLabel(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${m}/${d}`;
}

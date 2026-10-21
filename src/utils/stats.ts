/**
 * Calculations for the 統計 tab. All work on appointments already loaded for
 * a date range; customers are identified by name, as Apps Script resolves
 * 顧客ID refs to names.
 */
import type { Appointment } from '@/types/appointment';
import { addMonths, parseIsoDate, todayIsoDate } from '@/utils/dates';

/** Customer bookings only: 特別事項 rows are notes, not visits. */
export function isCustomerBooking(apt: Appointment): boolean {
  return apt.service !== '特別事項' && apt.customerName.trim() !== '';
}

/** A booking that has happened (or is today), so it counts as a visit. */
function isPastOrToday(apt: Appointment, today: string): boolean {
  return apt.date <= today;
}

/** The last `count` months up to the month of `today`, oldest first, as YYYY-MM. */
export function recentMonths(count: number, today = todayIsoDate()): string[] {
  return Array.from({ length: count }, (_, i) =>
    addMonths(today, i - count + 1).slice(0, 7)
  );
}

export type MonthStats = {
  /** YYYY-MM */
  month: string;
  /** 收費 of bookings up to today */
  revenue: number;
  /** 收費 of bookings later this month, not yet done */
  upcomingRevenue: number;
  bookings: number;
  customers: number;
  /** Average 收費 per charged booking; null with none */
  averageSpend: number | null;
};

export function monthStats(apts: Appointment[], month: string, today = todayIsoDate()): MonthStats {
  const inMonth = apts.filter((apt) => isCustomerBooking(apt) && apt.date.startsWith(month));
  let revenue = 0;
  let upcomingRevenue = 0;
  let charged = 0;
  for (const apt of inMonth) {
    const price = apt.price ?? 0;
    if (isPastOrToday(apt, today)) {
      revenue += price;
      if (price > 0) charged += 1;
    } else {
      upcomingRevenue += price;
    }
  }
  return {
    month,
    revenue,
    upcomingRevenue,
    bookings: inMonth.length,
    customers: new Set(inMonth.map((apt) => apt.customerName)).size,
    averageSpend: charged > 0 ? Math.round(revenue / charged) : null,
  };
}

export type ServiceStats = { service: string; bookings: number; revenue: number };

/** Bookings and 收費 per service in a month, most booked first. */
export function serviceBreakdown(apts: Appointment[], month: string): ServiceStats[] {
  const byService = new Map<string, ServiceStats>();
  for (const apt of apts) {
    if (!isCustomerBooking(apt) || !apt.date.startsWith(month)) continue;
    const entry = byService.get(apt.service) ?? { service: apt.service, bookings: 0, revenue: 0 };
    entry.bookings += 1;
    entry.revenue += apt.price ?? 0;
    byService.set(apt.service, entry);
  }
  return [...byService.values()].sort((a, b) => b.bookings - a.bookings || b.revenue - a.revenue);
}

/** Visits per weekday (Sunday first) up to today. */
export function weekdayCounts(apts: Appointment[], today = todayIsoDate()): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const apt of apts) {
    if (!isCustomerBooking(apt) || !isPastOrToday(apt, today)) continue;
    counts[parseIsoDate(apt.date).getDay()] += 1;
  }
  return counts;
}

export type CustomerStats = {
  name: string;
  phone?: string;
  visits: number;
  spend: number;
  /** YYYY-MM-DD */
  lastVisit: string;
  lastService: string;
  /** Has a booking after today */
  hasUpcoming: boolean;
};

/** Per-customer totals over the loaded range (visits up to today only). */
export function customerStats(apts: Appointment[], today = todayIsoDate()): CustomerStats[] {
  const byName = new Map<string, CustomerStats>();
  for (const apt of apts) {
    if (!isCustomerBooking(apt)) continue;
    const entry = byName.get(apt.customerName) ?? {
      name: apt.customerName,
      visits: 0,
      spend: 0,
      lastVisit: '',
      lastService: '',
      hasUpcoming: false,
    };
    if (apt.phone) entry.phone = apt.phone;
    if (isPastOrToday(apt, today)) {
      entry.visits += 1;
      entry.spend += apt.price ?? 0;
      if (apt.date > entry.lastVisit) {
        entry.lastVisit = apt.date;
        entry.lastService = apt.service;
      }
    } else {
      entry.hasUpcoming = true;
    }
    byName.set(apt.customerName, entry);
  }
  return [...byName.values()].filter((c) => c.visits > 0);
}

/** Highest spending customers. */
export function topCustomers(stats: CustomerStats[], limit: number): CustomerStats[] {
  return [...stats].sort((a, b) => b.spend - a.spend || b.visits - a.visits).slice(0, limit);
}

/**
 * Regulars who haven't been back for a while and have nothing booked: worth
 * a WhatsApp. Most recently lapsed first, since they're the likeliest to return.
 */
export function lapsedCustomers(
  stats: CustomerStats[],
  { minVisits, minDays }: { minVisits: number; minDays: number },
  today = todayIsoDate()
): (CustomerStats & { daysSince: number })[] {
  return stats
    .filter((c) => !c.hasUpcoming && c.visits >= minVisits)
    .map((c) => ({ ...c, daysSince: daysBetween(c.lastVisit, today) }))
    .filter((c) => c.daysSince >= minDays)
    .sort((a, b) => a.daysSince - b.daysSince);
}

export function daysBetween(from: string, to: string): number {
  const ms = parseIsoDate(to).getTime() - parseIsoDate(from).getTime();
  // Round, since a daylight-saving change makes a day 23 or 25 hours
  return Math.round(ms / 86_400_000);
}

/** e.g. $12,800 */
export function formatMoney(amount: number): string {
  return `$${Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/** Short form for chart labels, e.g. $10.6k */
export function formatMoneyShort(amount: number): string {
  if (Math.abs(amount) < 1000) return formatMoney(amount);
  const k = amount / 1000;
  return `$${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')}k`;
}

/**
 * The open times posted to Instagram (可約時間), worked out from the bookings with the
 * studio's rules, which keep the owner's days light:
 * closed on Wednesdays, 10:00–22:00, 15 min between customers, at most 4 項目 and
 * 8 hours of customers a day (soft limits), a ≥60 min break once there are 3
 * customers, and at most 3 times listed a day.
 */
import type { Appointment } from '@/types/appointment';
import {
  addDays,
  minutesToTime,
  parseIsoDate,
  timeToMinutes,
  toIsoDate,
  WEEKDAY_LABELS,
} from '@/utils/dates';
import { isCustomerBooking } from '@/utils/stats';

const OPEN = 10 * 60;
const CLOSE = 22 * 60;
const BUFFER = 15;
const STEP = 15;
const NAIL = 150;
const LASH = 120;
const MAX_ITEMS = 4;
const MAX_WORK = 8 * 60;
const BREAK = 60;
const MAX_LISTED = 3;
/** 特別事項 and other non-customer rows without an end block this long. */
const DEFAULT_BLOCK = 120;
const WEDNESDAY = 3;

/** 項目 per service; top-ups and removals take time but count 0. */
const NO_ITEM = ['補甲', '補眼睫毛', '拆甲', '拆眼睫毛'];
function itemsOf(apt: Appointment): number {
  if (apt.service === '整甲 + 眼睫毛') return 2;
  return NO_ITEM.includes(apt.service) ? 0 : 1;
}

export type Slot = { time: string; lashesOnly: boolean };

export type DaySlots = {
  date: string;
  /** closed: Wednesday or blocked all day; full: nothing left. */
  status: 'closed' | 'full' | 'open';
  /** Customers' start times, listed struck through so the day doesn't look empty. */
  booked: string[];
  slots: Slot[];
};

type Span = { start: number; end: number };

/** The time a row takes within the day; one running past midnight is cut at closing. */
function spanOf(apt: Appointment): Span {
  const start = timeToMinutes(apt.time);
  const end = apt.endTime ? timeToMinutes(apt.endTime) : NaN;
  if (end > start) return { start, end };
  if (apt.endTime && end < start) return { start, end: CLOSE }; // runs past midnight
  return { start, end: start + (apt.durationMinutes || DEFAULT_BLOCK) };
}

/** A customer's full length for the 8-hour limit, past midnight included. */
function workOf(apt: Appointment): number {
  const span = spanOf(apt);
  if (!apt.endTime || timeToMinutes(apt.endTime) >= span.start) return span.end - span.start;
  return timeToMinutes(apt.endTime) + 24 * 60 - span.start;
}

/** Overlapping spans joined, in time order. */
function merged(spans: Span[]): Span[] {
  const out: Span[] = [];
  for (const s of [...spans].sort((a, b) => a.start - b.start)) {
    const last = out[out.length - 1];
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else out.push({ ...s });
  }
  return out;
}

/** Whether `blocks` together cover all of opening hours. */
function coversDay(blocks: Span[]): boolean {
  let reached = OPEN;
  for (const b of [...blocks].sort((x, y) => x.start - y.start)) {
    if (b.start > reached) return false;
    reached = Math.max(reached, b.end);
  }
  return reached >= CLOSE;
}

/** The longest stretch from `start` to `end` that none of `blocks` touches. */
function longestFree(start: number, end: number, blocks: Span[]): number {
  let longest = 0;
  let cursor = start;
  for (const b of [...blocks].sort((x, y) => x.start - y.start)) {
    if (b.end <= cursor || b.start >= end) continue;
    longest = Math.max(longest, b.start - cursor);
    cursor = Math.max(cursor, b.end);
  }
  return Math.max(longest, end - cursor);
}

/**
 * With 3 or more customers, some gap between two of them must hold a free ≥60 min break,
 * with no 特別事項 in it (overlapping bookings joined first, so no gap hides inside one).
 */
function hasBreak(customers: Span[], others: Span[]): boolean {
  if (customers.length < 3) return true;
  const sorted = merged(customers);
  return sorted.some(
    (s, i) => i > 0 && longestFree(sorted[i - 1].end, s.start, others) >= BREAK
  );
}

const ceilStep = (m: number) => Math.ceil(m / STEP) * STEP;
const floorStep = (m: number) => Math.floor(m / STEP) * STEP;

/**
 * One day's open times. `appointments` are that day's rows. `notBefore` (minutes) drops
 * times already past, for today.
 */
export function daySlots(date: string, appointments: Appointment[], notBefore = 0): DaySlots {
  const rows = appointments.filter((a) => a.date === date && a.status !== 'No show');
  const customers = rows.filter(isCustomerBooking);
  const others = rows.filter((a) => !isCustomerBooking(a)).map(spanOf);
  const booked = customers.map((a) => a.time).sort();
  const result = (status: DaySlots['status'], slots: Slot[] = []): DaySlots => ({
    date,
    status,
    // The cell fits 3 times: open ones first, then as many booked ones as still fit
    booked: status === 'open' ? booked.slice(0, Math.max(0, MAX_LISTED - slots.length)) : [],
    slots,
  });

  if (parseIsoDate(date).getDay() === WEDNESDAY) return result('closed');
  if (customers.length === 0 && coversDay(others)) return result('closed');

  const items = customers.reduce((n, a) => n + itemsOf(a), 0);
  const taken = customers.map(spanOf);
  const work = customers.reduce((n, a) => n + workOf(a), 0);
  if (items >= MAX_ITEMS || work > MAX_WORK - LASH) return result('full');

  // Free windows between every row, each kept 15 min clear
  const busy = [...taken, ...others]
    .map((s) => ({ start: s.start - BUFFER, end: s.end + BUFFER }))
    .sort((a, b) => a.start - b.start);
  const windows: Span[] = [];
  let cursor = Math.max(OPEN, ceilStep(notBefore));
  for (const b of [...busy, { start: CLOSE, end: CLOSE }]) {
    const end = Math.min(b.start, CLOSE);
    if (end - cursor >= LASH) windows.push({ start: cursor, end });
    cursor = Math.max(cursor, b.end);
  }

  const chosen: Span[] = [];
  // Whether a new customer at `span` keeps within the limits, with `planned` also booked
  const fitsLimits = (span: Span, planned: Span[]) =>
    items + planned.length + 1 <= MAX_ITEMS &&
    work + [...planned, span].reduce((n, s) => n + s.end - s.start, 0) <= MAX_WORK;
  const fits = (span: Span, planned: Span[]) =>
    fitsLimits(span, planned) && hasBreak([...taken, ...planned, span], others);

  const slots: Slot[] = [];
  for (const w of windows) {
    let t = ceilStep(w.start);
    let last: Slot | undefined;
    while (slots.length < MAX_LISTED && t + LASH <= w.end) {
      const nail = { start: t, end: t + NAIL };
      const lash = { start: t, end: t + LASH };
      if (nail.end <= w.end && fits(nail, chosen)) {
        last = { time: minutesToTime(t), lashesOnly: false };
      } else if (fits(lash, chosen)) {
        last = { time: minutesToTime(t), lashesOnly: true };
      } else if (fitsLimits(lash, chosen)) {
        t += STEP; // only the break is missing: try a little later
        continue;
      } else break;
      const span = last.lashesOnly ? lash : nail;
      chosen.push(span);
      slots.push(last);
      t = span.end + BUFFER;
    }

    // Limits stopped the list with time left: offer the latest start too, as an alternative
    if (!last || slots.length >= MAX_LISTED) continue;
    const lastSpan = chosen[chosen.length - 1];
    const before = chosen.slice(0, -1);
    for (const [length, lashesOnly] of [[NAIL, false], [LASH, true]] as const) {
      const start = floorStep(w.end - length);
      const span = { start, end: start + length };
      if (start >= lastSpan.end + BUFFER && fits(span, before)) {
        slots.push({ time: minutesToTime(start), lashesOnly });
        break;
      }
    }
  }

  return slots.length ? result('open', slots) : result('full');
}

/** Every day from `from` to `to`; `now` drops today's times already past. */
export function availableSlots(
  from: string,
  to: string,
  appointments: Appointment[],
  now = new Date()
): DaySlots[] {
  const today = toIsoDate(now);
  const days: DaySlots[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    // Seconds count too, so 11:00 is gone at 11:00:45
    const notBefore =
      d === today ? now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 : 0;
    days.push(daySlots(d, appointments, notBefore));
  }
  return days;
}

/** e.g. 23/11 */
export function dayMonth(iso: string): string {
  const d = parseIsoDate(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/** The WhatsApp / text version, in the format the studio settled on. */
export function slotsText(days: DaySlots[]): string {
  const lines = days.map((day) => {
    const label = `${dayMonth(day.date)}（${WEEKDAY_LABELS[parseIsoDate(day.date).getDay()]}）`;
    if (day.status === 'closed') return `${label} 休息`;
    if (day.status === 'full') return `${label} 已滿`;
    const times = [
      ...day.booked.map((t) => ({ t, text: `~${t}~` })),
      ...day.slots.map((s) => ({ t: s.time, text: s.lashesOnly ? `${s.time}（只限眼睫毛）` : s.time })),
    ].sort((a, b) => a.t.localeCompare(b.t));
    return `${label} ${times.map((x) => x.text).join('・')}`;
  });
  const range = days.length ? `${dayMonth(days[0].date)} 至 ${dayMonth(days[days.length - 1].date)}` : '';
  return [
    `🗓 可約時間（${range}）— 以下時間都可以彈性安排，WhatsApp 我哋 🩷`,
    ...lines,
    '',
    '＊整甲約 2.5 小時、眼睫毛約 2 小時，一個項目一個時段 🙏',
    '＊淨拆甲／補睫毛／腳甲：WhatsApp 查詢及預約',
  ].join('\n');
}

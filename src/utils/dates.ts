/**
 * Date helpers for YYYY-MM-DD strings in the device's local timezone.
 * Weeks start on Sunday, matching the AppSheet timetable.
 */

export const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

const MONTH_LABELS = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
];

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toIsoDate(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export function todayIsoDate(): string {
  return toIsoDate(new Date());
}

export function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** First day of the month `months` away from the month containing `iso`. */
export function addMonths(iso: string, months: number): string {
  const date = parseIsoDate(iso);
  return toIsoDate(new Date(date.getFullYear(), date.getMonth() + months, 1));
}

export function startOfWeek(iso: string): string {
  return addDays(iso, -parseIsoDate(iso).getDay());
}

export function weekDates(iso: string): string[] {
  const start = startOfWeek(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Calendar grid for the month containing `iso`: full Sunday–Saturday weeks. */
export function monthGrid(iso: string): string[][] {
  const date = parseIsoDate(iso);
  const first = toIsoDate(new Date(date.getFullYear(), date.getMonth(), 1));
  const last = toIsoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0));

  const weeks: string[][] = [];
  for (let start = startOfWeek(first); start <= last; start = addDays(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, i)));
  }
  return weeks;
}

export function isSameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** e.g. 十月 2026 */
export function formatMonthTitle(iso: string): string {
  const date = parseIsoDate(iso);
  return `${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
}

/** e.g. 10月18日 – 24日, or 9月27日 – 10月3日 across months */
export function formatWeekTitle(iso: string): string {
  const days = weekDates(iso);
  const start = parseIsoDate(days[0]);
  const end = parseIsoDate(days[6]);
  const startText = `${start.getMonth() + 1}月${start.getDate()}日`;
  const endText =
    start.getMonth() === end.getMonth()
      ? `${end.getDate()}日`
      : `${end.getMonth() + 1}月${end.getDate()}日`;
  return `${startText} – ${endText}`;
}

/** "HH:mm" → minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Minutes since midnight → "HH:mm". */
export function minutesToTime(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/** e.g. 2026年10月21日（三） */
export function formatShortDate(iso: string): string {
  const date = parseIsoDate(iso);
  if (isNaN(date.getTime())) return iso;
  const weekday = WEEKDAY_LABELS[date.getDay()];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${weekday}）`;
}

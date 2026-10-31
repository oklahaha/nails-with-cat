/**
 * The 時間表's pages (a month, week or day), shared by both timetable screens
 * and the iOS pager.
 */
import type { Appointment } from '@/types/appointment';
import { addDays, addMonths, monthGrid, startOfWeek, weekDates } from '@/utils/dates';

export type ViewMode = 'day' | 'week' | 'month';

/** The anchor `pages` pages before (negative) or after `anchor`. */
export function shiftAnchor(mode: ViewMode, anchor: string, pages: number): string {
  if (mode === 'month') return addMonths(anchor, pages);
  return addDays(anchor, pages * (mode === 'week' ? 7 : 1));
}

/** Names the page an anchor falls on, so two anchors on one page match. */
export function pageKey(mode: ViewMode, anchor: string): string {
  if (mode === 'month') return anchor.slice(0, 7);
  return mode === 'week' ? startOfWeek(anchor) : anchor;
}

/**
 * Fetch the whole month grid (plus the anchor's week, which can spill into
 * the next month), so switching Day/Week/Month within a month doesn't refetch.
 */
export function timetableRange(anchor: string): { from: string; to: string } {
  const grid = monthGrid(anchor);
  const week = weekDates(anchor);
  const from = week[0] < grid[0][0] ? week[0] : grid[0][0];
  const last = grid[grid.length - 1][6];
  const to = week[6] > last ? week[6] : last;
  return { from, to };
}

/**
 * Whether the iOS pager draws page `i`: the one on screen at once, and its
 * neighbours only once they're next to the page it last settled on (-1 if
 * none yet). So a page opens without waiting for the two beside it, and the
 * page just left stays drawn while it slides away.
 */
export function shouldDrawPage(i: number, current: number, settled: number): boolean {
  if (i === current) return true;
  return Math.abs(i - current) <= 1 && settled !== -1 && Math.abs(i - settled) <= 1;
}

export function groupByDateSorted(appointments: Appointment[]): Map<string, Appointment[]> {
  const map = new Map<string, Appointment[]>();
  for (const apt of appointments) {
    const list = map.get(apt.date) ?? [];
    list.push(apt);
    map.set(apt.date, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.time.localeCompare(b.time));
  return map;
}

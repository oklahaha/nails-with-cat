/// <reference types="node" />
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createContext, runInContext } from 'vm';

/**
 * Code.gs runs in Apps Script, not here, so it's loaded as a plain script and
 * only the helpers that need no Google services are tested.
 */
type Script = {
  toHHmm_: (display: string) => string;
  toMinutes_: (value: unknown, display: string) => number | null;
  toIsoDate_: (value: unknown, display: string, tz: string) => string;
  hasEnded_: (date: string, time: string, endTime: string, today: string, nowTime: string) => boolean;
  addMinutes_: (hhmm: string, minutes: number) => string;
  customerSource_: (
    input: { source?: string | null },
    headers: string[]
  ) => { source: string | undefined; needsColumn: boolean };
  ensureSourceColumn_: (sheet: FakeSheet, headers: string[]) => string[];
};

/** Just the parts of an Apps Script Sheet that ensureSourceColumn_ uses, recording writes. */
type FakeSheet = {
  getLastColumn: () => number;
  getRange: (row: number, col: number) => { setValue: (value: string) => void };
  writes: { row: number; col: number; value: string }[];
};

function fakeSheet(lastColumn: number): FakeSheet {
  const writes: FakeSheet['writes'] = [];
  return {
    writes,
    getLastColumn: () => lastColumn,
    getRange: (row, col) => ({ setValue: (value) => writes.push({ row, col, value }) }),
  };
}

const script = createContext({}) as unknown as Script;
runInContext(readFileSync(join(__dirname, 'Code.gs'), 'utf8'), script as never);

describe('Code.gs sheet parsers', () => {
  it('reads displayed times in any format as HH:mm', () => {
    expect(script.toHHmm_('14:30:00')).toBe('14:30');
    expect(script.toHHmm_('下午2:30')).toBe('14:30');
    expect(script.toHHmm_('2:30 PM')).toBe('14:30');
    expect(script.toHHmm_('12:15 AM')).toBe('00:15');
    expect(script.toHHmm_('')).toBe('');
  });

  it('reads durations as minutes', () => {
    expect(script.toMinutes_('', '2:30:00')).toBe(150);
    expect(script.toMinutes_(150, '150')).toBe(150);
    // A duration-formatted cell: a fraction of a day
    expect(script.toMinutes_(2.5 / 24, '2:30:00')).toBe(150);
    expect(script.toMinutes_('', '')).toBeNull();
  });

  it('reads year-first and day-first text dates', () => {
    expect(script.toIsoDate_('', '2026/10/1', 'Asia/Hong_Kong')).toBe('2026-10-01');
    expect(script.toIsoDate_('21/10/2026', '21/10/2026', 'Asia/Hong_Kong')).toBe('2026-10-21');
  });

  it('wraps end times past midnight', () => {
    expect(script.addMinutes_('23:00', 120)).toBe('01:00');
  });

  it('knows when a booking is over', () => {
    expect(script.hasEnded_('2026-11-03', '14:00', '16:00', '2026-11-04', '09:00')).toBe(true);
    expect(script.hasEnded_('2026-11-04', '14:00', '16:00', '2026-11-04', '15:59')).toBe(false);
    expect(script.hasEnded_('2026-11-04', '14:00', '16:00', '2026-11-04', '16:00')).toBe(true);
    // Runs past midnight: not over on its own day
    expect(script.hasEnded_('2026-11-04', '23:00', '01:00', '2026-11-04', '23:59')).toBe(false);
    expect(script.hasEnded_('2026-11-05', '14:00', '16:00', '2026-11-04', '23:59')).toBe(false);
  });

  it('writes 來源 only when sent, and asks for the column when it is missing', () => {
    const withColumn = ['顧客ID', '顧客姓名', '電話', '來源'];
    expect(script.customerSource_({}, withColumn)).toEqual({ source: undefined, needsColumn: false });
    expect(script.customerSource_({ source: ' Instagram ' }, withColumn)).toEqual({
      source: 'Instagram',
      needsColumn: false,
    });
    // Clearing it needs no column; setting one without it gets the column added
    expect(script.customerSource_({ source: '' }, ['顧客姓名'])).toEqual({ source: '', needsColumn: false });
    expect(script.customerSource_({ source: '朋友介紹' }, ['顧客姓名'])).toEqual({
      source: '朋友介紹',
      needsColumn: true,
    });
  });

  it('adds the 來源 header after the last column, never over an existing one', () => {
    const headers = ['顧客ID', '顧客姓名', '電話', 'IG', '加入日期'];
    const sheet = fakeSheet(5);
    expect(script.ensureSourceColumn_(sheet, headers)).toEqual([...headers, '來源']);
    expect(sheet.writes).toEqual([{ row: 1, col: 6, value: '來源' }]);

    // Data in a column past the headers (an unnamed column): go after it, keeping positions
    const wide = fakeSheet(7);
    expect(script.ensureSourceColumn_(wide, headers)).toEqual([...headers, '', '', '來源']);
    expect(wide.writes).toEqual([{ row: 1, col: 8, value: '來源' }]);

    // Already there: nothing written
    const done = fakeSheet(6);
    expect(script.ensureSourceColumn_(done, [...headers, '來源'])).toEqual([...headers, '來源']);
    expect(done.writes).toEqual([]);
  });
});

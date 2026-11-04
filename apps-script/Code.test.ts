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
};

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
});

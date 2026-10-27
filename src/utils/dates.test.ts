import { describe, expect, it } from '@jest/globals';

import { addDays, addMonths, minutesToTime, monthGrid, timeToMinutes } from './dates';

describe('minutesToTime', () => {
  it('formats minutes since midnight', () => {
    expect(minutesToTime(0)).toBe('00:00');
    expect(minutesToTime(14 * 60 + 5)).toBe('14:05');
  });

  it('wraps past midnight, as Apps Script does', () => {
    expect(minutesToTime(timeToMinutes('23:00') + 120)).toBe('01:00');
    expect(minutesToTime(-30)).toBe('23:30');
  });
});

describe('date helpers', () => {
  it('adds days and months across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('builds the month grid from Sunday-first weeks', () => {
    const grid = monthGrid('2026-11-15');
    expect(grid[0][0]).toBe('2026-11-01'); // a Sunday
    expect(grid[grid.length - 1][6]).toBe('2026-12-05');
    expect(grid.every((week) => week.length === 7)).toBe(true);
  });
});

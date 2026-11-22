import { describe, expect, it } from '@jest/globals';

import {
  addDays,
  addMonths,
  formatDuration,
  isDayPick,
  minutesToTime,
  monthGrid,
  studioTime,
  timeToMinutes,
} from './dates';

describe('formatDuration', () => {
  it('shows minutes as hours', () => {
    expect(formatDuration(120)).toBe('2 小時');
    expect(formatDuration(150)).toBe('2.5 小時');
    expect(formatDuration(100)).toBe('1.67 小時');
  });

  it('keeps durations under an hour in minutes', () => {
    expect(formatDuration(45)).toBe('45 分鐘');
  });
});

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

describe('isDayPick', () => {
  it('is a day tap when the day number changes', () => {
    expect(isDayPick('2026-11-19', '2026-11-03')).toBe(true);
    expect(isDayPick('2026-11-19', '2026-12-05')).toBe(true);
  });
  it('is month/year navigation when only the month or year changes', () => {
    expect(isDayPick('2026-11-19', '2026-12-19')).toBe(false);
    expect(isDayPick('2026-11-19', '2027-11-19')).toBe(false);
  });
  it('is the wheel when it clamps the 31st to a shorter month', () => {
    expect(isDayPick('2026-01-31', '2026-02-28')).toBe(false);
    expect(isDayPick('2028-01-31', '2028-02-29')).toBe(false);
    expect(isDayPick('2026-03-31', '2026-04-30')).toBe(false);
    // A tap on the last day from an earlier day number is still a tap
    expect(isDayPick('2026-01-10', '2026-02-28')).toBe(true);
  });
});

describe('studioTime', () => {
  it('reads the Hong Kong wall clock whatever the phone’s zone', () => {
    const hk = studioTime(new Date(Date.UTC(2026, 10, 24, 5, 0, 30)));
    expect([hk.getDate(), hk.getHours(), hk.getMinutes(), hk.getSeconds()]).toEqual([24, 13, 0, 30]);
    // 20:00 UTC is already the next day in Hong Kong
    expect(studioTime(new Date(Date.UTC(2026, 10, 24, 20, 0))).getDate()).toBe(25);
  });
});

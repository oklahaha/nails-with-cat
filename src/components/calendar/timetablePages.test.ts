import { describe, expect, it } from '@jest/globals';

import { pageKey, shiftAnchor } from './timetablePages';

describe('shiftAnchor', () => {
  it('moves by months, weeks or days', () => {
    expect(shiftAnchor('month', '2026-10-29', 1)).toBe('2026-11-01');
    expect(shiftAnchor('month', '2026-01-15', -1)).toBe('2025-12-01');
    expect(shiftAnchor('week', '2026-10-29', -2)).toBe('2026-10-15');
    expect(shiftAnchor('day', '2026-10-31', 1)).toBe('2026-11-01');
  });
});

describe('pageKey', () => {
  it('gives anchors on the same page the same key', () => {
    expect(pageKey('month', '2026-10-01')).toBe(pageKey('month', '2026-10-29'));
    // Weeks start on Sunday: 2026-10-25 is one
    expect(pageKey('week', '2026-10-29')).toBe('2026-10-25');
    expect(pageKey('week', '2026-10-24')).not.toBe(pageKey('week', '2026-10-25'));
    expect(pageKey('day', '2026-10-29')).toBe('2026-10-29');
  });
});

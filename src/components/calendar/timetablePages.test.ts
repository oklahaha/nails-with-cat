import { describe, expect, it } from '@jest/globals';

import {
  pageKey,
  shiftAnchor,
  shouldDrawPage,
} from './timetablePages';

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

describe('shouldDrawPage', () => {
  it('draws only the page on screen until one has settled', () => {
    expect(shouldDrawPage(5, 5, -1)).toBe(true);
    expect(shouldDrawPage(4, 5, -1)).toBe(false);
    expect(shouldDrawPage(6, 5, -1)).toBe(false);
  });

  it('draws both neighbours once settled', () => {
    expect(shouldDrawPage(4, 5, 5)).toBe(true);
    expect(shouldDrawPage(6, 5, 5)).toBe(true);
  });

  it('leaves pages further away undrawn', () => {
    expect(shouldDrawPage(3, 5, 5)).toBe(false);
    expect(shouldDrawPage(7, 5, 5)).toBe(false);
  });

  it('keeps the page just left drawn during a swipe, but waits with the new neighbour', () => {
    // Swiped from 5 to 6, not settled yet
    expect(shouldDrawPage(5, 6, 5)).toBe(true);
    expect(shouldDrawPage(7, 6, 5)).toBe(false);
  });
});

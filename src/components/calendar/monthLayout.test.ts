import { describe, expect, it } from '@jest/globals';

import { layoutMonth, WEEKDAY_ROW_HEIGHT } from './monthLayout';

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** Everything the month draws, which must never be more than it has. */
function usedHeight(chipsPerWeek: number[], height: number, legendRows = 2) {
  const layout = layoutMonth(height, chipsPerWeek, legendRows);
  return WEEKDAY_ROW_HEIGHT + layout.footerHeight + sum(layout.weekHeights);
}

describe('layoutMonth', () => {
  it('keeps chips full size and shares the spare height when the month fits', () => {
    const layout = layoutMonth(600, [1, 0, 2, 1, 0], 2);
    expect(layout.chipHeight).toBe(15);
    expect(layout.fontSize).toBe(10);
    // Every week gets the same share of the spare height, on top of what it needs
    expect(layout.weekHeights[2] - layout.weekHeights[1]).toBeCloseTo(34);
    expect(layout.weekHeights[1]).toBeGreaterThan(34);
  });

  it('gives a busier week more height', () => {
    const { weekHeights } = layoutMonth(600, [6, 1, 1, 1, 1], 2);
    expect(weekHeights[0]).toBeGreaterThan(weekHeights[1]);
  });

  it('shrinks chips rather than overflow in a very busy month', () => {
    const chips = [8, 8, 8, 8, 8, 8];
    const layout = layoutMonth(560, chips, 3);
    expect(layout.chipHeight).toBeLessThan(15);
    expect(usedHeight(chips, 560, 3)).toBeLessThanOrEqual(560);
  });

  it('never uses more than the height it has', () => {
    for (const chips of [[0, 0, 0, 0], [1, 2, 3, 4, 5], [12, 12, 12, 12, 12, 12]]) {
      for (const height of [420, 560, 700]) {
        expect(usedHeight(chips, height)).toBeLessThanOrEqual(height);
      }
    }
  });

  it('drops the text when chips are too small to read', () => {
    expect(layoutMonth(420, [20, 20, 20, 20, 20, 20], 2).fontSize).toBe(0);
  });

  it('makes the footer taller for a long legend', () => {
    expect(layoutMonth(600, [1], 1).footerHeight).toBe(66);
    expect(layoutMonth(600, [1], 4).footerHeight).toBeGreaterThan(66);
  });

  it('has no negative sizes before the height is known', () => {
    const layout = layoutMonth(0, [3, 3], 1);
    expect(layout.chipHeight).toBeGreaterThanOrEqual(0);
    for (const week of layout.weekHeights) expect(week).toBeGreaterThanOrEqual(0);
  });
});

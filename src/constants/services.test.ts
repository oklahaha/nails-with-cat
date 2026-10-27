import { describe, expect, it } from '@jest/globals';

import { defaultDurationFor, defaultPriceFor, type ServiceChoices } from './services';

const none = { removal: false, extension: false, complexDesign: '不是複雜款' };

describe('default Duration and 收費', () => {
  it.each<[string, ServiceChoices, number, number]>([
    ['手', { handOrFoot: '手', ...none }, 120, 218],
    ['腳', { handOrFoot: '腳', ...none }, 60, 298],
    ['手 + 腳', { handOrFoot: '手 + 腳', ...none }, 180, 516],
  ])('整甲 for %s', (_, choices, minutes, price) => {
    expect(defaultDurationFor('整甲', choices)).toBe(minutes);
    expect(defaultPriceFor('整甲', choices)).toBe(price);
  });

  it('整甲 + 眼睫毛 adds 眼睫毛 (2 h, $428) to 整甲 for the same 手/腳', () => {
    const hand = { handOrFoot: '手', ...none };
    expect(defaultDurationFor('整甲 + 眼睫毛', hand)).toBe(240);
    expect(defaultPriceFor('整甲 + 眼睫毛', hand)).toBe(646);
    const foot = { handOrFoot: '腳', ...none };
    expect(defaultDurationFor('整甲 + 眼睫毛', foot)).toBe(180);
    expect(defaultPriceFor('整甲 + 眼睫毛', foot)).toBe(726);
  });

  it.each<[string, Partial<ServiceChoices>, number, number]>([
    ['拆甲', { removal: true }, 30, 0],
    ['延長', { extension: true }, 60, 100],
    ['複雜款 半個鐘', { complexDesign: '半個鐘' }, 30, 60],
    ['複雜款 一個鐘', { complexDesign: '一個鐘' }, 60, 120],
  ])('%s adds its time and 收費 to 整甲 for 手', (_, extra, minutes, price) => {
    const choices = { handOrFoot: '手', ...none, ...extra };
    expect(defaultDurationFor('整甲', choices)).toBe(120 + minutes);
    expect(defaultPriceFor('整甲', choices)).toBe(218 + price);
  });

  it('adds every add-on together', () => {
    const all = { handOrFoot: '手', removal: true, extension: true, complexDesign: '一個鐘' };
    expect(defaultDurationFor('整甲', all)).toBe(120 + 30 + 60 + 60);
    expect(defaultPriceFor('整甲', all)).toBe(218 + 0 + 100 + 120);
  });
});

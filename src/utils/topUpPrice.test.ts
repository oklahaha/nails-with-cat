import { describe, expect, it } from '@jest/globals';

import { makeAppointment } from '@/test/appointment';

import { lastSetHint, topUpPrice, topUpRuleFor } from './topUpPrice';

const lashes = topUpRuleFor('補眼睫毛')!;
const nails = topUpRuleFor('補甲')!;
const date = '2026-11-20';

const set = (service: string, setDate: string, overrides = {}) =>
  makeAppointment({ id: `${service}-${setDate}`, service, date: setDate, ...overrides });

describe('topUpPrice', () => {
  it.each([
    ['the same day', '2026-11-20', 0],
    ['5 days before', '2026-11-15', 0],
    ['6 days before', '2026-11-14', 214],
    ['14 days before', '2026-11-06', 214],
    ['15 days before', '2026-11-05', 428],
  ])('補眼睫毛 after 眼睫毛 %s', (_, setDate, price) => {
    expect(topUpPrice(lashes, [set('眼睫毛', setDate)], '陳小姐', date)).toBe(price);
  });

  it.each([
    ['5 days before', '2026-11-15', 0],
    ['6 days before', '2026-11-14', 30],
  ])('補甲 after 整甲 %s', (_, setDate, price) => {
    expect(topUpPrice(nails, [set('整甲', setDate)], '陳小姐', date)).toBe(price);
  });

  it('counts 整甲 + 眼睫毛 as a set for both top-ups', () => {
    const history = [set('整甲 + 眼睫毛', '2026-11-18')];
    expect(topUpPrice(lashes, history, '陳小姐', date)).toBe(0);
    expect(topUpPrice(nails, history, '陳小姐', date)).toBe(0);
  });

  it('skips a set the customer didn\'t come to', () => {
    const history = [set('眼睫毛', '2026-11-08'), set('眼睫毛', '2026-11-18', { status: 'No show' })];
    expect(topUpPrice(lashes, history, '陳小姐', date)).toBe(214);
  });

  it('charges the full price with no set in the history', () => {
    expect(topUpPrice(lashes, [], '陳小姐', date)).toBe(428);
    expect(topUpPrice(nails, [], '陳小姐', date)).toBe(30);
  });

  it('ignores other customers, later sets, other services and the booking being edited', () => {
    const history = [
      set('眼睫毛', '2026-11-19', { customerName: '李小姐' }),
      set('眼睫毛', '2026-11-21'),
      set('補眼睫毛', '2026-11-19'),
      set('眼睫毛', '2026-11-18', { id: 'editing' }),
    ];
    expect(topUpPrice(lashes, history, '陳小姐', date, 'editing')).toBe(428);
  });

  it('matches the customer name ignoring surrounding spaces', () => {
    const history = [set('眼睫毛', '2026-11-19', { customerName: ' 陳小姐 ' })];
    expect(topUpPrice(lashes, history, '陳小姐 ', date)).toBe(0);
  });
});

describe('lastSetHint', () => {
  it('says how long ago the last set was', () => {
    expect(lastSetHint(lashes, '2026-11-15', date)).toMatch(/5 日前$/);
    expect(lastSetHint(lashes, date, date)).toMatch(/同日$/);
  });

  it('says when there was none in the lookback', () => {
    expect(lastSetHint(lashes, undefined, date)).toBe('過去 14 日冇做過眼睫毛');
  });
});

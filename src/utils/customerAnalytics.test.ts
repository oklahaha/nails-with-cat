import { describe, expect, it } from '@jest/globals';

import { makeAppointment } from '@/test/appointment';
import type { CustomerAnalytics, CustomerInsight } from '@/types/customerAnalytics';

import {
  atRiskCustomers,
  dueSoonCustomers,
  formatPercent,
  hasFreshAnalytics,
  nextForecastWeek,
  segmentSummary,
} from './customerAnalytics';

const TODAY = '2026-10-30';

function insight(overrides: Partial<CustomerInsight> = {}): CustomerInsight {
  return {
    customerId: '1',
    name: '陳小美',
    segment: '活躍熟客',
    pAlive: 0.9,
    expectedNextVisit: null,
    churn: true,
    pReturn60d: 0.2,
    clv12m: 1000,
    lastVisit: '2026-08-01',
    visits: 10,
    hasUpcoming: false,
    ...overrides,
  };
}

function analytics(customers: CustomerInsight[]): CustomerAnalytics {
  return { updatedAt: `${TODAY} 03:00`, customers, forecast: [] };
}

describe('hasFreshAnalytics', () => {
  it('accepts results up to 7 days old', () => {
    const results = analytics([insight()]);
    expect(hasFreshAnalytics({ ...results, updatedAt: '2026-10-23 03:00' }, TODAY)).toBe(true);
    expect(hasFreshAnalytics({ ...results, updatedAt: '2026-10-22 03:00' }, TODAY)).toBe(false);
  });

  it('rejects missing or empty results', () => {
    expect(hasFreshAnalytics(null, TODAY)).toBe(false);
    expect(hasFreshAnalytics({ updatedAt: null, customers: [], forecast: [] }, TODAY)).toBe(false);
    expect(hasFreshAnalytics(analytics([]), TODAY)).toBe(false);
  });
});

describe('atRiskCustomers', () => {
  it('keeps flagged customers in the segments worth contacting, highest value first', () => {
    const rows = atRiskCustomers(
      analytics([
        insight({ customerId: '1', clv12m: 100 }),
        insight({ customerId: '2', clv12m: 900, segment: '疏遠中' }),
        insight({ customerId: '3', segment: '一次客' }),
        insight({ customerId: '4', churn: false }),
      ]),
      [],
      []
    );
    expect(rows.map((r) => r.customerId)).toEqual(['2', '1']);
  });

  it('hides customers who booked or visited after the run', () => {
    const results = analytics([insight()]);
    const booked = makeAppointment({ customerName: '陳小美', date: '2026-11-05' });
    const visited = makeAppointment({ customerName: '陳小美', date: '2026-10-30' });
    expect(atRiskCustomers(results, [], [booked])).toEqual([]);
    expect(atRiskCustomers(results, [], [visited])).toEqual([]);
  });

  it('keeps them when the later booking was a No show', () => {
    const noShow = makeAppointment({ customerName: '陳小美', date: '2026-11-05', status: 'No show' });
    expect(atRiskCustomers(analytics([insight()]), [], [noShow])).toHaveLength(1);
  });

  it('uses the current name and phone from 顧客, matched by 顧客ID', () => {
    const renamed = [{ id: '1', name: '陳美', phone: '85291234567' }];
    const [row] = atRiskCustomers(analytics([insight()]), renamed, []);
    expect(row.name).toBe('陳美');
    expect(row.phone).toBe('85291234567');

    // Their new booking is under the new name
    const booked = makeAppointment({ customerName: '陳美', date: '2026-11-05' });
    expect(atRiskCustomers(analytics([insight()]), renamed, [booked])).toEqual([]);
  });
});

describe('dueSoonCustomers', () => {
  const due = (id: string, date: string | null, churn = false) =>
    insight({ customerId: id, expectedNextVisit: date, churn });

  it('keeps customers expected within 3 weeks, soonest first', () => {
    const rows = dueSoonCustomers(
      analytics([
        due('late', '2026-11-21'),
        due('soon', '2026-11-05'),
        due('edge', '2026-11-20'),
        due('never', null),
        due('flagged', '2026-11-05', true),
      ]),
      [],
      [],
      TODAY
    );
    expect(rows.map((r) => r.customerId)).toEqual(['soon', 'edge']);
  });
});

describe('segmentSummary', () => {
  it('sums customers and the share of value, most valuable first', () => {
    const summary = segmentSummary(
      analytics([
        insight({ segment: '疏遠中', clv12m: 100 }),
        insight({ segment: '活躍熟客', clv12m: 200 }),
        insight({ segment: '活躍熟客', clv12m: 700 }),
      ])
    );
    expect(summary.map((s) => [s.segment, s.customers, s.clvShare])).toEqual([
      ['活躍熟客', 2, 0.9],
      ['疏遠中', 1, 0.1],
    ]);
  });

  it('copes with no value at all', () => {
    expect(segmentSummary(analytics([insight({ clv12m: 0 })]))[0].clvShare).toBe(0);
  });
});

describe('nextForecastWeek', () => {
  it('skips the week already under way', () => {
    const week = (weekStart: string) => ({
      weekStart,
      bookings: 15,
      bookingsLow: 9,
      bookingsHigh: 21,
      revenue: 3700,
      daysOff: 0,
    });
    const forecast = [week('2026-10-26'), week('2026-11-02')];
    expect(nextForecastWeek(forecast, TODAY)?.weekStart).toBe('2026-11-02');
    expect(nextForecastWeek(forecast, '2026-11-02')).toBeUndefined();
  });
});

describe('formatPercent', () => {
  it('rounds, and shows a dash when unknown', () => {
    expect(formatPercent(0.234)).toBe('23%');
    expect(formatPercent(null)).toBe('—');
  });
});

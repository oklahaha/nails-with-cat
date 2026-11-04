import { describe, expect, it } from '@jest/globals';

import { makeAppointment } from '@/test/appointment';
import type { CustomerAnalytics, CustomerInsight } from '@/types/customerAnalytics';

import {
  atRiskCustomers,
  dueSoonCustomers,
  forecastSegments,
  formatPercent,
  hasFreshAnalytics,
  insightSummary,
  nextForecastWeek,
  recentWeeklyBookings,
  segmentCustomers,
  segmentSummary,
  visitDistribution,
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

describe('visitDistribution', () => {
  it('sorts customers into visit-count buckets, keeping empty ones', () => {
    const counts = visitDistribution(
      analytics([insight({ visits: 1 }), insight({ visits: 3 }), insight({ visits: 40 })])
    );
    expect(counts.map((c) => c.customers)).toEqual([1, 1, 0, 0, 1]);
  });
});

describe('forecastSegments', () => {
  const week = { weekStart: '2026-11-02', bookings: 14, bookingsLow: 8, bookingsHigh: 20, revenue: 0, daysOff: 0 };

  it('stacks up to the top of the range, with the tick at the forecast', () => {
    const segments = forecastSegments([week]);
    expect(segments.map((s) => s.kind)).toEqual(['gap', 'range', 'tick', 'range']);
    expect(segments.every((s) => s.x === '11/2')).toBe(true);
    expect(segments.reduce((sum, s) => sum + s.y, 0)).toBeCloseTo(20);
    expect(segments[0].y + segments[1].y).toBeCloseTo(13.75);
  });

  it('never goes negative, even with no range to speak of', () => {
    const flat = forecastSegments([{ ...week, bookings: 0, bookingsLow: 0, bookingsHigh: 0 }]);
    expect(flat.every((s) => s.y >= 0)).toBe(true);
  });
});

describe('recentWeeklyBookings', () => {
  it('averages the finished weeks only', () => {
    const apts = [
      // 2026-10-30 is a Friday; finished weeks end on Sunday 2026-10-25
      makeAppointment({ id: 'in', date: '2026-10-25' }),
      makeAppointment({ id: 'first', date: '2026-08-31' }),
      makeAppointment({ id: 'this-week', date: '2026-10-26' }),
      makeAppointment({ id: 'too-old', date: '2026-08-30' }),
    ];
    expect(recentWeeklyBookings(apts, TODAY)).toBe(2 / 8);
  });

  it('treats a Sunday as part of the week still going', () => {
    const apts = [makeAppointment({ id: 'sunday', date: '2026-11-01' })];
    expect(recentWeeklyBookings(apts, '2026-11-01')).toBe(0);
  });
});

describe('segmentCustomers', () => {
  it('lists one segment, highest value first, then most recently seen', () => {
    const rows = segmentCustomers(
      analytics([
        insight({ customerId: 'old', segment: '一次客', clv12m: 0, lastVisit: '2024-01-01' }),
        insight({ customerId: 'recent', segment: '一次客', clv12m: 0, lastVisit: '2026-01-01' }),
        insight({ customerId: 'rich', segment: '一次客', clv12m: 50, lastVisit: '2023-01-01' }),
        insight({ customerId: 'other', segment: '新客', clv12m: 900 }),
      ]),
      [],
      '一次客'
    );
    expect(rows.map((r) => r.customerId)).toEqual(['rich', 'recent', 'old']);
  });

  it('keeps customers who have booked, and uses the current name and phone', () => {
    const [row] = segmentCustomers(
      analytics([insight({ hasUpcoming: true })]),
      [{ id: '1', name: '陳美', phone: '85291234567' }],
      '活躍熟客'
    );
    expect(row.name).toBe('陳美');
    expect(row.phone).toBe('85291234567');
    expect(insightSummary(row)).toBe('上次 8月1日 · 共 10 次 · 已有預約');
  });
});

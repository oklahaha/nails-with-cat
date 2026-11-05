import { describe, expect, it } from '@jest/globals';

import type { AnalyticsSummaryRow, CustomerAnalytics, CustomerInsight } from '@/types/customerAnalytics';

import {
  expectedReturns,
  findings,
  formatRate,
  hasSummary,
  insightFor,
  modelCheck,
  newCustomerReturn,
  newCustomerSources,
  nextServices,
  revenueShares,
  visitRhythm,
  workload,
} from './analysisSummary';

function row(item: string, group: string, value: number | null, extra: Partial<AnalyticsSummaryRow> = {}): AnalyticsSummaryRow {
  return { item, group, subgroup: '', value, low: null, high: null, n: 50, ...extra };
}

function insight(overrides: Partial<CustomerInsight> = {}): CustomerInsight {
  return {
    customerId: '1',
    name: '陳小美',
    segment: '活躍熟客',
    pAlive: 0.9,
    expectedNextVisit: null,
    churn: false,
    pReturn60d: 0.5,
    clv12m: 1000,
    lastVisit: '2026-10-01',
    visits: 5,
    hasUpcoming: false,
    ...overrides,
  };
}

function analytics(summary?: AnalyticsSummaryRow[], customers: CustomerInsight[] = []): CustomerAnalytics {
  return { updatedAt: '2026-11-05 03:00', customers, forecast: [], summary };
}

describe('analysisSummary', () => {
  it('has a summary only with numbers in it (older runs and caches have none)', () => {
    expect(hasSummary(analytics())).toBe(false);
    expect(hasSummary(analytics([row('gap_median', '整甲', null)]))).toBe(false);
    expect(hasSummary(analytics([row('gap_median', '整甲', 36)]))).toBe(true);
  });

  it('orders the visit rhythm by service and joins the never-return share', () => {
    const rhythm = visitRhythm(
      analytics([
        row('gap_median', '整甲 + 眼睫毛', 31),
        row('gap_median', '整甲', 36, { low: 35, high: 37 }),
        row('never_return', '整甲', 0.14),
        row('gap_median', '眼睫毛', 29),
      ])
    );
    expect(rhythm.map((r) => r.label)).toEqual(['整甲', '眼睫毛', '整甲 + 眼睫毛']);
    expect(rhythm[0]).toMatchObject({ value: 36, low: 35, high: 37, neverReturn: 0.14 });
    expect(rhythm[1].neverReturn).toBeNull();
  });

  it('splits new-customer return rates into overall, service and source', () => {
    const result = newCustomerReturn(
      analytics([
        row('new_return', '眼睫毛', 0.67),
        row('new_return', '全部', 0.41),
        row('new_return', '整甲', 0.37),
        row('new_return_source', '路過', 0.2),
        row('new_return_source', '朋友介紹', 0.6),
      ])
    );
    expect(result.overall?.value).toBe(0.41);
    expect(result.byService.map((r) => r.label)).toEqual(['整甲', '眼睫毛']);
    expect(result.bySource.map((r) => r.label)).toEqual(['朋友介紹', '路過']);
  });

  it('folds small next services into 其他, largest first', () => {
    const [mix] = nextServices(
      analytics([
        row('next_service', '整甲', 0.05, { subgroup: '整甲 + 眼睫毛', n: 1000 }),
        row('next_service', '整甲', 0.87, { subgroup: '整甲', n: 1000 }),
        row('next_service', '整甲', 0.03, { subgroup: '拆甲', n: 1000 }),
        row('next_service', '整甲', 0.02, { subgroup: '補甲', n: 1000 }),
        row('next_service', '整甲', 0.03, { subgroup: '眼睫毛', n: 1000 }),
      ])
    );
    expect(mix.total).toBe(1000);
    expect(mix.next.map((n) => n.service)).toEqual(['整甲', '整甲 + 眼睫毛', '其他']);
    expect(mix.next[2].share).toBeCloseTo(0.08);
  });

  it('skips months with too few open days and keeps months in order', () => {
    const months = workload(
      analytics([
        row('workload', '2026-11', 7, { n: 2 }),
        row('workload', '2026-10', 6.2, { n: 27 }),
        row('two_at_once', '2026-10', 0.07, { n: 27 }),
        row('workload', '2026-09', 6.3, { n: 22 }),
      ])
    );
    expect(months.map((m) => m.label)).toEqual(['9月', '10月']);
    expect(months[1]).toMatchObject({ hours: 6.2, twoAtOnce: 0.07, openDays: 27 });
  });

  it('reads the model check and the revenue shares', () => {
    const a = analytics([
      row('model_check', '預計會回來', 0.81, { n: 391 }),
      row('model_check', '預計不會回來', 0.09, { n: 851 }),
      row('revenue_share', '頭 20%', 0.57, { n: 191 }),
    ]);
    expect(modelCheck(a)).toEqual({
      expectedBack: 0.81,
      expectedBackCount: 391,
      notExpectedBack: 0.09,
      notExpectedBackCount: 851,
    });
    expect(modelCheck(analytics([]))).toBeNull();
    expect(revenueShares(a)).toEqual([{ label: '頭 20%', share: 0.57, customers: 191 }]);
  });

  it('sums expected returns without customers already booked', () => {
    const a = analytics([], [
      insight({ pReturn60d: 0.8 }),
      insight({ pReturn60d: 0.5, hasUpcoming: true }),
      insight({ pReturn60d: null }),
      insight({ pReturn60d: 0.2 }),
    ]);
    expect(expectedReturns(a)).toBeCloseTo(1.0);
  });

  it('counts new customers per source in the window', () => {
    const result = newCustomerSources(
      [
        { id: '1', name: 'A', phone: '', joinedDate: '2026-10-01', source: 'Instagram' },
        { id: '2', name: 'B', phone: '', joinedDate: '2026-03-01', source: 'Instagram' },
        { id: '3', name: 'C', phone: '', joinedDate: '2026-09-15', source: '朋友介紹' },
        { id: '4', name: 'D', phone: '', joinedDate: '2026-08-01' },
        { id: '5', name: 'E', phone: '', joinedDate: '2025-10-31', source: '路過' },
        { id: '6', name: 'F', phone: '' },
      ],
      '2026-11-05'
    );
    expect(result.sources).toEqual([
      { source: 'Instagram', customers: 2 },
      { source: '朋友介紹', customers: 1 },
    ]);
    expect(result.unknown).toBe(1);
  });

  it('finds a customer by 顧客ID, or by name without one', () => {
    const a = analytics([], [insight({ customerId: 'C1', name: '甲' }), insight({ customerId: '', name: '乙' })]);
    expect(insightFor(a, { id: 'C1', name: '改了名' })?.name).toBe('甲');
    expect(insightFor(a, { id: '', name: '乙' })?.customerId).toBe('');
    expect(insightFor(a, { id: 'C9', name: '甲' })).toBeUndefined();
  });

  it('lists findings in their order, skipping rows without a sentence', () => {
    const a = analytics([
      row('finding', '收入', 2, { text: '頭 20% 顧客帶來 57% 收入。' }),
      row('finding', '回訪節奏', 1, { text: '眼睫毛顧客較快回來。' }),
      row('finding', '空', 3),
      row('gap_median', '整甲', 36),
    ]);
    expect(findings(a)).toEqual([
      { topic: '回訪節奏', text: '眼睫毛顧客較快回來。' },
      { topic: '收入', text: '頭 20% 顧客帶來 57% 收入。' },
    ]);
  });

  it('formats a rate with its interval', () => {
    expect(formatRate({ value: 0.364, low: 0.29, high: 0.445 })).toBe('36%（29–45%）');
    expect(formatRate({ value: 0.5, low: null, high: null })).toBe('50%');
  });
});

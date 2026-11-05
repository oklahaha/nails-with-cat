/** Made-up analysis results for UI development, dated relative to today so they stay fresh. */
import type { AnalyticsSummaryRow, CustomerAnalytics, CustomerInsight } from '@/types/customerAnalytics';
import { addDays, addMonths, startOfWeek, todayIsoDate } from '@/utils/dates';

export function mockCustomerAnalytics(): CustomerAnalytics {
  const today = todayIsoDate();
  // startOfWeek is a Sunday; forecast weeks run from Monday
  const monday = addDays(startOfWeek(today), 1);

  const customer = (
    id: string,
    name: string,
    segment: string,
    fields: Partial<CustomerInsight>
  ): CustomerInsight => ({
    customerId: `CUST-MOCK-${id}`,
    name,
    segment,
    pAlive: 0.8,
    expectedNextVisit: null,
    churn: false,
    pReturn60d: 0.5,
    clv12m: 1000,
    lastVisit: addDays(today, -30),
    visits: 5,
    hasUpcoming: false,
    ...fields,
  });

  return {
    updatedAt: `${today} 03:00`,
    customers: [
      customer('1', '何美儀', '活躍熟客', {
        churn: true,
        pReturn60d: 0.23,
        clv12m: 3200,
        lastVisit: addDays(today, -80),
      }),
      customer('2', '李嘉欣', '疏遠中', {
        churn: true,
        pReturn60d: 0.11,
        clv12m: 900,
        lastVisit: addDays(today, -150),
      }),
      customer('3', '張詠詩', '活躍熟客', {
        expectedNextVisit: addDays(today, 9),
        pReturn60d: 0.9,
        clv12m: 4100,
      }),
      customer('4', '黃子晴', '新客', { visits: 1, clv12m: 300, lastVisit: addDays(today, -20) }),
      customer('5', '吳曉琳', '一次客', {
        visits: 1,
        clv12m: 0,
        churn: true,
        lastVisit: addDays(today, -400),
      }),
    ],
    forecast: Array.from({ length: 12 }, (_, i) => ({
      weekStart: addDays(monday, i * 7),
      bookings: 15 - (i % 3),
      bookingsLow: 9,
      bookingsHigh: 21,
      revenue: 3700,
      daysOff: i === 1 ? 1 : 0,
    })),
    summary: mockSummary(today),
  };
}

/** 分析摘要 rows shaped like a real run's (analysis/src/analysis/summary.py). */
function mockSummary(today: string): AnalyticsSummaryRow[] {
  const row = (item: string, group: string, value: number, extra: Partial<AnalyticsSummaryRow> = {}) => ({
    item,
    group,
    subgroup: '',
    value,
    low: null,
    high: null,
    n: 100,
    ...extra,
  });
  const months = Array.from({ length: 12 }, (_, i) => addMonths(today, i - 11).slice(0, 7));
  return [
    row('gap_median', '整甲', 36, { low: 35, high: 37, n: 2737 }),
    row('gap_median', '眼睫毛', 29, { low: 27, high: 32, n: 518 }),
    row('gap_median', '整甲 + 眼睫毛', 31, { low: 28, high: 33, n: 340 }),
    row('never_return', '整甲', 0.14, { low: 0.13, high: 0.16 }),
    row('never_return', '眼睫毛', 0.16, { low: 0.13, high: 0.19 }),
    row('never_return', '整甲 + 眼睫毛', 0.07, { low: 0.04, high: 0.1 }),
    row('new_return', '全部', 0.41, { low: 0.34, high: 0.48, n: 170 }),
    row('new_return', '整甲', 0.37, { low: 0.29, high: 0.45, n: 148 }),
    row('new_return', '眼睫毛', 0.67, { low: 0.44, high: 0.84, n: 18 }),
    row('revenue_share', '頭 10%', 0.37, { n: 191 }),
    row('revenue_share', '頭 20%', 0.57, { n: 191 }),
    row('revenue_share', '頭 50%', 0.88, { n: 191 }),
    row('next_service', '整甲', 0.87, { subgroup: '整甲', n: 1136 }),
    row('next_service', '整甲', 0.05, { subgroup: '整甲 + 眼睫毛', n: 1136 }),
    row('next_service', '整甲', 0.08, { subgroup: '拆甲', n: 1136 }),
    row('next_service', '眼睫毛', 0.41, { subgroup: '補眼睫毛', n: 124 }),
    row('next_service', '眼睫毛', 0.33, { subgroup: '眼睫毛', n: 124 }),
    row('next_service', '眼睫毛', 0.16, { subgroup: '整甲', n: 124 }),
    row('next_service', '眼睫毛', 0.1, { subgroup: '整甲 + 眼睫毛', n: 124 }),
    ...months.flatMap((m, i) => [
      row('workload', m, 6.5 + (i % 4) * 0.5, { n: 25 }),
      row('two_at_once', m, 0.1 + (i % 3) * 0.08, { n: 25 }),
    ]),
    row('model_check', '預計會回來', 0.81, { n: 391 }),
    row('model_check', '預計不會回來', 0.09, { n: 851 }),
    row('model_check', 'AUC', 0.94, { n: 1242 }),
    row('finding', '回訪節奏', 1, { text: '眼睫毛顧客平均約 29 日回來，比整甲（約 36 日）快。' }),
    row('finding', '收入', 2, { text: '消費最多的 20% 顧客帶來 57% 收入。' }),
  ];
}

/** Made-up analysis results for UI development, dated relative to today so they stay fresh. */
import type { CustomerAnalytics, CustomerInsight } from '@/types/customerAnalytics';
import { addDays, startOfWeek, todayIsoDate } from '@/utils/dates';

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
  };
}

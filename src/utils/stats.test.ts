import { describe, expect, it } from '@jest/globals';

import { makeAppointment } from '@/test/appointment';

import {
  averageFullMonthRevenue,
  busyHeatmap,
  isCustomerBooking,
  monthStats,
  topCustomersShare,
  type CustomerStats,
} from './stats';

describe('isCustomerBooking', () => {
  it('skips 特別事項, rows without a customer and No show bookings', () => {
    expect(isCustomerBooking(makeAppointment())).toBe(true);
    expect(isCustomerBooking(makeAppointment({ service: '特別事項' }))).toBe(false);
    expect(isCustomerBooking(makeAppointment({ customerName: ' ' }))).toBe(false);
    expect(isCustomerBooking(makeAppointment({ status: 'No show' }))).toBe(false);
  });

  it('leaves No show bookings out of the revenue', () => {
    const apts = [
      makeAppointment({ id: 'a', date: '2026-10-02', price: 218 }),
      makeAppointment({ id: 'b', date: '2026-10-03', price: 428, status: 'No show' }),
    ];
    const stats = monthStats(apts, '2026-10', '2026-10-30');
    expect(stats.revenue).toBe(218);
    expect(stats.bookings).toBe(1);
  });
});

describe('busyHeatmap', () => {
  it('counts visits by start-time band and weekday, up to today', () => {
    const map = busyHeatmap(
      [
        // 2026-10-27 is a Tuesday
        makeAppointment({ id: 'a', date: '2026-10-27', time: '10:30' }),
        makeAppointment({ id: 'b', date: '2026-10-27', time: '10:59' }),
        makeAppointment({ id: 'c', date: '2026-10-27', time: '11:00' }),
        makeAppointment({ id: 'd', date: '2026-10-25', time: '21:00' }),
        makeAppointment({ id: 'future', date: '2026-11-03', time: '10:00' }),
        makeAppointment({ id: 'noshow', date: '2026-10-27', time: '10:00', status: 'No show' }),
      ],
      '2026-10-30'
    );
    expect(map.counts[0][2]).toBe(2);
    expect(map.counts[1][2]).toBe(1);
    expect(map.counts[5][0]).toBe(1);
    expect(map.max).toBe(2);
    expect(map.peak).toEqual({ band: '11時前', weekday: 2 });
  });

  it('has no peak without visits, and skips rows without a time', () => {
    const map = busyHeatmap([makeAppointment({ date: '2026-10-27', time: '' })], '2026-10-30');
    expect(map.max).toBe(0);
    expect(map.peak).toBeNull();
  });
});

describe('averageFullMonthRevenue', () => {
  const month = (revenue: number) =>
    ({ month: '', revenue, upcomingRevenue: 0, bookings: 0, customers: 0, averageSpend: null });

  it('leaves out the current month and empty months', () => {
    expect(averageFullMonthRevenue([month(0), month(100), month(300), month(9999)])).toBe(200);
  });

  it('is 0 with nothing to average', () => {
    expect(averageFullMonthRevenue([month(500)])).toBe(0);
  });
});

describe('topCustomersShare', () => {
  const customer = (spend: number): CustomerStats => ({
    name: String(spend),
    visits: 1,
    spend,
    lastVisit: '2026-10-01',
    lastService: '整甲',
    hasUpcoming: false,
  });

  it('is the top customers\' share of the total spend', () => {
    expect(topCustomersShare([customer(100), customer(300)], 1)).toBe(0.75);
  });

  it('is 0 with no spend', () => {
    expect(topCustomersShare([], 10)).toBe(0);
  });
});

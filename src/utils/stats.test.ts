import { describe, expect, it } from '@jest/globals';

import { makeAppointment } from '@/test/appointment';

import { isCustomerBooking, monthStats } from './stats';

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

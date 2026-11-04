import { describe, expect, it } from '@jest/globals';

import { makeAppointment } from '@/test/appointment';
import { previousKeptDeposit } from '@/utils/keptDeposit';

const kept = makeAppointment({ id: 'a', date: '2026-10-01', time: '11:00', keepDeposit: true });

describe('previousKeptDeposit', () => {
  it('finds the previous booking when it kept the deposit', () => {
    expect(previousKeptDeposit([kept], '2026-11-01', '11:00')).toBe(kept);
  });

  it('ignores a 保留 that a later visit came after', () => {
    const later = makeAppointment({ id: 'b', date: '2026-10-15', time: '11:00' });
    expect(previousKeptDeposit([kept, later], '2026-11-01', '11:00')).toBeUndefined();
  });

  it('skips No show bookings and the booking itself', () => {
    const noShow = makeAppointment({ id: 'b', date: '2026-10-15', time: '11:00', status: 'No show' });
    const self = makeAppointment({ id: 'c', date: '2026-10-20', time: '11:00' });
    expect(previousKeptDeposit([kept, noShow, self], '2026-10-20', '11:00', 'c')).toBe(kept);
  });

  it('only looks at earlier bookings', () => {
    expect(previousKeptDeposit([kept], '2026-10-01', '11:00')).toBeUndefined();
    expect(previousKeptDeposit([kept], '2026-09-01', '11:00')).toBeUndefined();
  });
});

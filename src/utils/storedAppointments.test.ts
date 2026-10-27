import { describe, expect, it } from '@jest/globals';

import { makeAppointment } from '@/test/appointment';

import { parseRanges, serializeRanges } from './storedAppointments';

describe('serializeRanges / parseRanges', () => {
  it('round-trips ranges, keeping each range’s order', () => {
    const a = makeAppointment({ id: 'a' });
    const b = makeAppointment({ id: 'b', time: '10:00' });
    const entries: [string, typeof a[]][] = [
      ['2026-11-01|2026-11-30', [b, a]],
      ['customer::陳小姐', [a]],
    ];
    expect(parseRanges(serializeRanges(entries))).toEqual(entries);
  });

  it('saves a booking shared by several ranges only once', () => {
    const a = makeAppointment({ id: 'a' });
    const stored = JSON.parse(serializeRanges([['x|', [a]], ['y|', [a]]]));
    expect(stored.appointments).toHaveLength(1);
    expect(stored.ranges).toEqual([['x|', ['a']], ['y|', ['a']]]);
  });

  it('keeps the newest range’s version when ranges disagree', () => {
    const newer = makeAppointment({ id: 'a', time: '15:00' });
    const older = makeAppointment({ id: 'a', time: '14:00' });
    const parsed = parseRanges(serializeRanges([['new|', [newer]], ['old|', [older]]]));
    expect(parsed.map(([, list]) => list[0].time)).toEqual(['15:00', '15:00']);
  });

  it.each([null, '', 'not json', '[["v1-shaped", []]]', '{"ranges": 3}'])(
    'returns no ranges for unreadable data (%p)',
    (json) => {
      expect(parseRanges(json)).toEqual([]);
    }
  );
});

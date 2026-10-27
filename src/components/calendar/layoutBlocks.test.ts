import { describe, expect, it } from '@jest/globals';

import { makeAppointment } from '@/test/appointment';

import { layoutBlocks, visibleHours } from './layoutBlocks';

const apt = (id: string, time: string, endTime?: string, durationMinutes?: number) =>
  makeAppointment({ id, time, endTime, durationMinutes });

const lanes = (blocks: ReturnType<typeof layoutBlocks>) =>
  Object.fromEntries(blocks.map((b) => [b.appointment.id, [b.lane, b.lanes]]));

describe('layoutBlocks', () => {
  it('gives bookings that don’t overlap the full width', () => {
    const blocks = layoutBlocks([apt('a', '10:00', '12:00'), apt('b', '12:00', '13:00')]);
    expect(lanes(blocks)).toEqual({ a: [0, 1], b: [0, 1] });
  });

  it('puts overlapping bookings side by side', () => {
    const blocks = layoutBlocks([
      apt('a', '10:00', '12:00'),
      apt('b', '11:00', '13:00'),
      // Starts once a has ended, so it takes a's lane, still within the cluster
      apt('c', '12:00', '13:00'),
    ]);
    expect(lanes(blocks)).toEqual({ a: [0, 2], b: [1, 2], c: [0, 2] });
  });

  it('sorts by start time and falls back to Duration without an End Time', () => {
    const [first, second] = layoutBlocks([apt('late', '15:00'), apt('early', '09:00', undefined, 90)]);
    expect(first.appointment.id).toBe('early');
    expect([first.start, first.end]).toEqual([540, 630]);
    expect(second.appointment.id).toBe('late');
  });

  it('draws zero-length rows (特別事項) at least 30 minutes long', () => {
    const [block] = layoutBlocks([apt('note', '14:00', '14:00')]);
    expect(block.end - block.start).toBe(30);
  });
});

describe('visibleHours', () => {
  it('shows 09:00–21:00, widened to fit bookings outside it', () => {
    expect(visibleHours([])).toEqual([9, 21]);
    expect(visibleHours(layoutBlocks([apt('a', '07:30', '08:30')]))).toEqual([7, 21]);
    expect(visibleHours(layoutBlocks([apt('a', '21:00', '22:15')]))).toEqual([9, 23]);
  });
});

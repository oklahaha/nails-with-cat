import { describe, expect, it } from '@jest/globals';

import { makeAppointment } from '@/test/appointment';

import { buildLocalNotifications } from './localNotifications';

const now = new Date(2026, 10, 2, 8, 0); // 2 Nov 2026, 08:00 local

describe('buildLocalNotifications', () => {
  it('reminds an hour before each booking and sums up the day at 09:00', () => {
    const list = buildLocalNotifications(
      [
        makeAppointment({ id: 'a', time: '14:00', customerName: '陳小姐' }),
        makeAppointment({ id: 'b', time: '11:00', customerName: '李小姐' }),
      ],
      now
    );
    expect(list.map((n) => [n.at.getHours(), n.at.getMinutes(), n.title])).toEqual([
      [9, 0, '今日有 2 個預約'],
      [10, 0, '一小時後：李小姐'],
      [13, 0, '一小時後：陳小姐'],
    ]);
    expect(list[0].body).toBe('11:00 李小姐、14:00 陳小姐');
    expect(list[1].data).toEqual({ appointmentId: 'b' });
  });

  it('skips 特別事項, rows without a customer, and times already past', () => {
    const list = buildLocalNotifications(
      [
        makeAppointment({ id: 'note', service: '特別事項', customerName: '' }),
        makeAppointment({ id: 'blank', customerName: ' ' }),
        // Its reminder (07:30) has passed; the 09:00 summary hasn't
        makeAppointment({ id: 'early', time: '08:30' }),
      ],
      now
    );
    expect(list.map((n) => n.title)).toEqual(['今日有 1 個預約']);
  });

  it('keeps only the earliest 60, as iOS drops pending ones past 64', () => {
    const many = Array.from({ length: 70 }, (_, i) =>
      makeAppointment({ id: `a${i}`, date: '2026-11-03', time: `${String(11 + (i % 10)).padStart(2, '0')}:00` })
    );
    const list = buildLocalNotifications(many, now);
    expect(list).toHaveLength(60);
    expect(list[0].title).toBe('今日有 70 個預約');
  });
});

import { describe, expect, it } from '@jest/globals';

import { makeAppointment } from '@/test/appointment';

import { buildTodayWidgetTimeline } from './todayWidgetTimeline';

/** UserDefaults (where expo-widgets saves props) throws on null. */
function hasNull(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value !== 'object') return false;
  return Object.values(value).some(hasNull);
}

describe('buildTodayWidgetTimeline', () => {
  const now = new Date(2026, 10, 2, 9, 0);

  it('leaves next out, never null, once no booking is left', () => {
    const entries = buildTodayWidgetTimeline(
      [makeAppointment({ date: '2026-11-02', time: '14:00' })],
      '2026-11-02',
      now
    );
    expect(entries[0].props.next?.time).toBe('14:00');
    const after = entries[entries.length - 1].props;
    expect('next' in after).toBe(false);
    expect(entries.some((entry) => hasNull(entry.props))).toBe(false);
  });
});

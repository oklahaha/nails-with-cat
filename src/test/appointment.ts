import type { Appointment } from '@/types/appointment';

/** A 整甲 booking with sensible defaults, for tests. */
export function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 'a1',
    service: '整甲',
    notes: '',
    customerName: '陳小姐',
    date: '2026-11-02',
    time: '14:00',
    status: '預約',
    ...overrides,
  };
}

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Appointment } from '@/types/appointment';

let mockSession: object | null;
const mockLoad = jest.fn<() => Promise<Appointment[]>>();
const mockWidget = jest.fn();
const mockSchedule = jest.fn<(appointments: Appointment[]) => Promise<void>>();
jest.mock('@/auth/session', () => ({ getSession: () => mockSession }));
jest.mock('@/hooks/useAppointments', () => ({ loadAppointments: () => mockLoad() }));
jest.mock('@/services/appointmentsApi', () => ({ onAppointmentsChanged: () => () => {} }));
jest.mock('@/widgets/updateTodayWidget', () => ({ updateTodayWidget: (...args: unknown[]) => mockWidget(...args) }));
jest.mock('@/notifications/notifications', () => ({ scheduleLocalNotifications: (appointments: Appointment[]) => mockSchedule(appointments) }));

// eslint-disable-next-line import/first
import { syncUpcoming } from './useUpcomingSync';

beforeEach(() => {
  mockSession = {};
  mockLoad.mockReset(); mockWidget.mockClear(); mockSchedule.mockReset();
  mockSchedule.mockResolvedValue();
});

describe('background authorization', () => {
  it('clears external copies without fetching when the session is rejected', async () => {
    mockSession = null;
    await syncUpcoming();
    expect(mockLoad).not.toHaveBeenCalled();
    expect(mockWidget).toHaveBeenCalledWith([], expect.any(String));
    expect(mockSchedule).toHaveBeenCalledWith([]);
  });

  it('does not publish data returned after authorization changes', async () => {
    let resolve!: (rows: Appointment[]) => void;
    mockLoad.mockReturnValue(new Promise((done) => { resolve = done; }));
    const sync = syncUpcoming();
    mockSession = null;
    resolve([]);
    await sync;
    expect(mockWidget).not.toHaveBeenCalled();
    expect(mockSchedule).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { makeAppointment } from '@/test/appointment';
import type { Appointment } from '@/types/appointment';

const mockList = jest.fn<(range: { from?: string; to?: string }) => Promise<Appointment[]>>();
jest.mock('@/services/appointmentsApi', () => ({
  listAppointments: (range: { from?: string; to?: string }) => mockList(range),
}));
jest.mock('@/utils/persistentStorage', () => ({
  readStored: () => null,
  writeStored: () => {},
  removeStored: () => {},
}));
jest.mock('expo-router', () => ({ useFocusEffect: () => {} }));

type Cache = typeof import('./useAppointments');

/** A fresh copy of the module, so each test starts with an empty cache. */
function fresh(): Cache {
  let mod!: Cache;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('./useAppointments');
  });
  return mod;
}

const NOV = { from: '2026-11-01', to: '2026-11-30' };

beforeEach(() => {
  jest.useFakeTimers();
  mockList.mockReset();
});

describe('appointments cache', () => {
  it('keeps a pending save over a reload that does not have it yet', async () => {
    const cache = fresh();
    const booking = makeAppointment({ id: 'new1' });
    cache.setPendingAppointment('new1', booking);
    mockList.mockResolvedValue([]);

    expect(await cache.loadAppointments(NOV)).toEqual([booking]);
  });

  it('keeps a pending delete over a reload that still has the row', async () => {
    const cache = fresh();
    mockList.mockResolvedValue([makeAppointment()]);
    await cache.loadAppointments(NOV);
    cache.setPendingAppointment('a1', null);

    expect(await cache.loadAppointments(NOV)).toEqual([]);
  });

  it('keeps an edit that finished while an older reload was running', async () => {
    const cache = fresh();
    let answer!: (list: Appointment[]) => void;
    mockList.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const reload = cache.loadAppointments(NOV);
    const edited = makeAppointment({ time: '16:00' });
    cache.settleAppointment('a1', edited);
    answer([makeAppointment({ time: '14:00' })]);

    expect((await reload)[0].time).toBe('16:00');
  });

  it('copies rows a reload returns into the other cached ranges', async () => {
    const cache = fresh();
    mockList.mockResolvedValueOnce([makeAppointment({ time: '14:00' })]);
    await cache.loadAppointments(NOV);
    // The other phone moved it; only today onwards is reloaded (the push sync)
    mockList.mockResolvedValueOnce([makeAppointment({ time: '16:00' })]);
    await cache.loadAppointments({ from: '2026-11-02' });

    // The month list is searched first, so it must hold the new time too
    expect(cache.findCachedAppointment('a1')?.time).toBe('16:00');
  });

  it('keeps the newer copy when an earlier-started reload answers last', async () => {
    const cache = fresh();
    let answerMonth!: (list: Appointment[]) => void;
    mockList.mockReturnValueOnce(new Promise((resolve) => (answerMonth = resolve)));
    const month = cache.loadAppointments(NOV);
    // The other phone moves it to 16:00, then the push sync starts and lands first
    jest.setSystemTime(Date.now() + 1000);
    mockList.mockResolvedValueOnce([makeAppointment({ time: '16:00' })]);
    await cache.loadAppointments({ from: '2026-11-02' });
    answerMonth([makeAppointment({ time: '14:00' })]);

    expect((await month)[0].time).toBe('16:00');
    expect(cache.findCachedAppointment('a1')?.time).toBe('16:00');
  });
});

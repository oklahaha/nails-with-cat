import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { makeAppointment } from '@/test/appointment';
import type { UpdateAppointmentInput } from '@/types/appointment';

const mockApi = {
  createAppointment: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  updateAppointment: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  deleteAppointment: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
};
const mockAlert = jest.fn();
const mockSettle = jest.fn();

/** A connection failure, as request() throws it (see isRetryable). */
class MockConnectionError extends Error {}
/** The session is gone, as apiToken() / parseResponse throw it. */
class MockAuthError extends Error {}

jest.mock('@/services/appointmentsApi', () => ({
  ...mockApi,
  addAppointmentPhoto: jest.fn(),
  removeAppointmentPhoto: jest.fn(),
  isRetryable: (e: unknown) => e instanceof MockConnectionError,
  AuthError: MockAuthError,
}));
jest.mock('@/hooks/useAppointments', () => ({
  setPendingAppointment: jest.fn(),
  setPendingPhoto: jest.fn(),
  settleAppointment: (...args: unknown[]) => mockSettle(...args),
  settlePhoto: jest.fn(),
  undoPhoto: jest.fn(),
}));
jest.mock('@/hooks/useUpcomingSync', () => ({ syncUpcoming: jest.fn() }));
jest.mock('@/hooks/useCustomers', () => ({ findCachedCustomer: () => undefined }));
jest.mock('@/services/photoFiles', () => ({}));
jest.mock('@/utils/persistentStorage', () => ({ readStored: () => null, writeStoredNow: () => {} }));
jest.mock('@/utils/alert', () => ({ showAlert: (...args: unknown[]) => mockAlert(...args) }));
jest.mock('@/utils/haptics', () => ({ hapticWarning: () => {} }));

type Writes = typeof import('./appointmentWrites');

/** A fresh copy, so one test's failed creates don't leak into the next. */
function load(): Writes {
  let mod!: Writes;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('./appointmentWrites');
  });
  return mod;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const input: UpdateAppointmentInput = {
  customerName: 'Seeing',
  date: '2026-11-09',
  time: '12:00',
  service: '整甲',
  notes: '',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.deleteAppointment.mockResolvedValue(undefined);
});

describe('appointment writes', () => {
  it('resends a create that got no answer, without reporting a failure', async () => {
    const { saveAppointment } = load();
    mockApi.createAppointment
      .mockRejectedValueOnce(new MockConnectionError('連線逾時'))
      .mockImplementationOnce(async (_input, id) => makeAppointment({ id: id as string }));

    const saved = saveAppointment(input);
    await settle();

    expect(mockApi.createAppointment).toHaveBeenCalledTimes(2);
    expect(mockApi.createAppointment.mock.calls[1][1]).toBe(saved.id);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it("doesn't resend a create the script refused", async () => {
    const { saveAppointment } = load();
    mockApi.createAppointment.mockRejectedValueOnce(new Error('欄位不存在'));

    saveAppointment(input);
    await settle();

    expect(mockApi.createAppointment).toHaveBeenCalledTimes(1);
    expect(mockAlert).toHaveBeenCalledTimes(1);
  });

  it('neither undoes nor reports a create refused for a lost session', async () => {
    const { saveAppointment } = load();
    mockApi.createAppointment.mockRejectedValueOnce(new MockAuthError('請重新登入'));

    saveAppointment(input);
    await settle();

    expect(mockApi.createAppointment).toHaveBeenCalledTimes(1);
    expect(mockAlert).not.toHaveBeenCalled();
    // Left pending for the resend after sign-in, not undone
    expect(mockSettle).not.toHaveBeenCalled();
  });

  it('still deletes and edits a booking whose create failed, since the row may exist', async () => {
    const { saveAppointment, removeAppointment, saveAppointmentStatus } = load();
    mockApi.createAppointment.mockRejectedValue(new MockConnectionError('連線逾時'));
    mockApi.updateAppointment.mockImplementation(async (id) => makeAppointment({ id: id as string }));

    const saved = saveAppointment(input);
    await settle();
    saveAppointmentStatus(saved, 'No show');
    removeAppointment(saved);
    await settle();

    expect(mockApi.updateAppointment.mock.calls[0][0]).toBe(saved.id);
    expect(mockApi.deleteAppointment).toHaveBeenCalledWith(saved.id);
    // Only the create's own failure is reported
    expect(mockAlert).toHaveBeenCalledTimes(1);
  });
});

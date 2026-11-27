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
const mockFindCached = jest.fn<(...args: unknown[]) => unknown>();
const mockRemovePhoto = jest.fn<(...args: unknown[]) => Promise<unknown>>();

/** A connection failure, as request() throws it (see isRetryable). */
class MockConnectionError extends Error {}
/** The session is gone, as apiToken() / parseResponse throw it. */
class MockAuthError extends Error {}

jest.mock('@/services/appointmentsApi', () => ({
  ...mockApi,
  addAppointmentPhoto: jest.fn(),
  removeAppointmentPhoto: (...args: unknown[]) => mockRemovePhoto(...args),
  isRetryable: (e: unknown) => e instanceof MockConnectionError,
  AuthError: MockAuthError,
  ScriptOutdatedError: class extends MockAuthError {},
}));
jest.mock('@/hooks/useAppointments', () => ({
  findCachedAppointment: (...args: unknown[]) => mockFindCached(...args),
  setPendingAppointment: jest.fn(),
  setPendingPhoto: jest.fn(),
  settleAppointment: (...args: unknown[]) => mockSettle(...args),
  settlePhoto: jest.fn(),
  undoPhoto: jest.fn(),
}));
jest.mock('@/hooks/useUpcomingSync', () => ({ syncUpcoming: jest.fn() }));
jest.mock('@/hooks/useCustomers', () => ({
  findCachedCustomer: () => undefined,
  getCachedCustomers: () => null,
}));
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

  it('resends an edit that got no answer with the same write id', async () => {
    const { saveAppointment } = load();
    const before = makeAppointment({ id: 'AAAAAAAAAAAAAAAAAAAAAA' });
    mockApi.updateAppointment
      .mockRejectedValueOnce(new MockConnectionError('連線逾時'))
      .mockImplementationOnce(async () => before);

    saveAppointment(input, before);
    await settle();

    expect(mockApi.updateAppointment).toHaveBeenCalledTimes(2);
    const [first, second] = mockApi.updateAppointment.mock.calls;
    expect(first[2]).toEqual(expect.any(String));
    expect(second[2]).toBe(first[2]);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it("gives an older app's queued 報價 to the booking's first 參考作品 only", () => {
    const { adoptLegacyQuote } = load();
    const apt = { ...makeAppointment({ id: 'B1' }), quote: 380 };
    const first = { apt, kind: 'reference' as const, path: 'p1' };
    const second = { apt, kind: 'reference' as const, path: 'p2' };
    const current = { apt, kind: 'reference' as const, path: 'p3', price: 450 };
    [first, second, current].forEach(adoptLegacyQuote);
    expect([first, second, current].map((p) => (p as { price?: number | null }).price)).toEqual([380, null, 450]);
    // The booking's first photo uploaded before the upgrade: no later one takes the 報價
    const { adoptLegacyQuote: adoptAgain } = load();
    mockFindCached.mockReturnValueOnce(makeAppointment({ id: 'B1', referencePhotos: ['p0'] }));
    const later = { apt, kind: 'reference' as const, path: 'p1' };
    adoptAgain(later);
    expect((later as { price?: number | null }).price).toBeNull();
  });

  it('takes a resent edit\'s answer whole, so fields cleared since stay cleared', async () => {
    const { saveAppointment } = load();
    const before = makeAppointment({ id: 'AAAAAAAAAAAAAAAAAAAAAA', price: 300 });
    const row = makeAppointment({ id: before.id });
    delete row.price;
    mockApi.updateAppointment.mockResolvedValueOnce({ ...row, repeated: true });

    saveAppointment({ ...input, price: 300 }, before);
    await settle();

    const settled = mockSettle.mock.calls.at(-1)?.[1] as { price?: number; repeated?: boolean };
    expect(settled.price).toBeUndefined();
    expect('repeated' in settled).toBe(false);
  });

  it('sends a 報價 again once a failed removal puts its photo back', async () => {
    const { removePhoto, wasRemovedHere } = load();
    mockRemovePhoto.mockRejectedValueOnce(new Error('失敗'));
    removePhoto(makeAppointment({ id: 'AAAAAAAAAAAAAAAAAAAAAA' }), 'reference', 'p1');
    expect(wasRemovedHere('p1')).toBe(true);
    await settle();
    expect(wasRemovedHere('p1')).toBe(false);
  });

  it("gives no older-app 報價 when the queued booking already had a photo", () => {
    const { adoptLegacyQuote } = load();
    const apt = { ...makeAppointment({ id: 'B2', referencePhotos: ['p0'] }), quote: 380 };
    const upload: { apt: typeof apt; kind: 'reference'; path: string; price?: number | null } = {
      apt,
      kind: 'reference',
      path: 'p1',
    };
    adoptLegacyQuote(upload);
    expect(upload.price).toBeNull();
  });

  it("sends an older outbox's single 報價 only when changed, for the photo it was for", () => {
    const { withoutLegacyQuote } = load();
    const before = { ...makeAppointment({ referencePhotos: ['p1', 'p2'] }), quote: 380 };
    const legacy = (quote?: number) => ({ ...input, quote }) as typeof input;
    // A No show replayed with the 報價 it had: nothing about 報價 is sent
    expect(withoutLegacyQuote(legacy(380), before)).toEqual(input);
    expect(withoutLegacyQuote(legacy(450), before)).toEqual({ ...input, quotesByPath: { p1: 450 } });
    expect(withoutLegacyQuote(legacy(450))).toEqual(input);
  });
});

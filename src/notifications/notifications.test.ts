import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockRouter = {
  navigate: jest.fn(),
  push: jest.fn(),
  canDismiss: jest.fn(() => false),
};
const mockLoad = jest.fn((_range: { from: string; to?: string }) => Promise.resolve([]));
const mockReloadCustomers = jest.fn(() => Promise.resolve());
const mockFindAppointment = jest.fn((_id: string): object | undefined => ({}));
const mockFindCustomer = jest.fn(
  (_key: { id?: string; name: string }): { id: string; name: string } | undefined => undefined
);

jest.mock('expo', () => ({ requireOptionalNativeModule: () => null }));
jest.mock('expo-constants', () => ({}));
// A getter: imports are hoisted above mockRouter's definition
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));
jest.mock('@/hooks/useAppointments', () => ({
  findCachedAppointment: (id: string) => mockFindAppointment(id),
  loadAppointments: (range: { from: string; to?: string }) => mockLoad(range),
}));
jest.mock('@/hooks/useCustomers', () => ({
  findCachedCustomer: (key: { id?: string; name: string }) => mockFindCustomer(key),
  reloadCustomers: () => mockReloadCustomers(),
}));
jest.mock('@/auth/session', () => ({ getSession: () => ({ email: 'test@example.com' }) }));
jest.mock('@/services/appointmentsApi', () => ({}));
jest.mock('@/utils/dates', () => ({ todayIsoDate: () => '2026-11-09' }));

// eslint-disable-next-line import/first
import { openNotificationData } from './notifications';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  jest.clearAllMocks();
  mockRouter.canDismiss.mockReturnValue(false);
});

describe('openNotificationData', () => {
  it('opens a reminder straight away, without a tab or reload', () => {
    openNotificationData({ appointmentId: 'a1' });
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(mockLoad).not.toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/appointment-details',
      params: { id: 'a1' },
    });
  });

  it('opens a pushed upcoming booking after loading from today', async () => {
    openNotificationData({ appointmentId: 'a1', appointmentDate: '2026-11-20' });
    expect(mockRouter.navigate).toHaveBeenCalledWith('/appointments');
    expect(mockLoad).toHaveBeenCalledWith({ from: '2026-11-09' });
    await flush();
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/appointment-details',
      params: { id: 'a1' },
    });
  });

  it('loads only the day of a pushed past booking', () => {
    openNotificationData({ appointmentId: 'a1', appointmentDate: '2026-10-01' });
    expect(mockLoad).toHaveBeenCalledWith({ from: '2026-10-01', to: '2026-10-01' });
  });

  it('opens only the tab after a delete', () => {
    openNotificationData({ appointmentDeleted: true });
    openNotificationData({ customerDeleted: true });
    expect(mockRouter.navigate.mock.calls).toEqual([['/appointments'], ['/customers']]);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('opens a pushed customer after reloading the list', async () => {
    mockFindCustomer.mockReturnValue({ id: 'c1', name: '陳小姐' });
    openNotificationData({ customerId: 'c1', customerName: '陳小姐' });
    expect(mockRouter.navigate).toHaveBeenCalledWith('/customers');
    await flush();
    expect(mockFindCustomer).toHaveBeenCalledWith({ id: 'c1', name: '陳小姐' });
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/customer-details',
      params: { id: 'c1', name: '陳小姐' },
    });
  });

  it("doesn't switch tabs over an open modal, but still opens the details", async () => {
    mockRouter.canDismiss.mockReturnValue(true);
    openNotificationData({ customerDeleted: true });
    openNotificationData({ appointmentId: 'a1', appointmentDate: '2026-11-20' });
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    await flush();
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/appointment-details',
      params: { id: 'a1' },
    });
  });

  it('opens nothing for an older tap or once the user opened a screen', async () => {
    openNotificationData({ appointmentId: 'a1', appointmentDate: '2026-11-20' });
    openNotificationData({ appointmentId: 'a2', appointmentDate: '2026-11-21' });
    await flush();
    expect(mockRouter.push.mock.calls).toEqual([
      [{ pathname: '/appointment-details', params: { id: 'a2' } }],
    ]);

    mockRouter.push.mockClear();
    openNotificationData({ appointmentId: 'a3', appointmentDate: '2026-11-21' });
    mockRouter.canDismiss.mockReturnValue(true); // the user opened a booking meanwhile
    await flush();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});

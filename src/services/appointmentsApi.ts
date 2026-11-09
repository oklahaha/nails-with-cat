/**
 * Appointment API layer — Google Apps Script Web App (see apps-script/).
 *
 * Configure in .env.local (see .env.example):
 *   EXPO_PUBLIC_APPS_SCRIPT_URL    the deployed /exec URL
 *   Authentication uses the signed-in account’s server-issued session.
 *
 * When the URL is empty, falls back to mock data so the UI still runs.
 * Which spreadsheet is used (copy vs real) is decided by the script's
 * SPREADSHEET_ID property, not by the app.
 */

import { getSession, signOut, type Session } from '@/auth/session';
import { mockCustomerAnalytics } from '@/data/mockCustomerAnalytics';
import { MOCK_APPOINTMENTS } from '@/data/mockAppointments';
import type {
  Appointment,
  NewAppointmentInput,
  UpdateAppointmentInput,
} from '@/types/appointment';
import type { Customer, CustomerInput, CustomerKey } from '@/types/customer';
import type { CustomerAnalytics } from '@/types/customerAnalytics';
import type { PhotoKind, PhotoSize } from '@/utils/appointmentPhotos';
import { todayIsoDate } from '@/utils/dates';
import { sheetPhone } from '@/utils/phone';

const APPS_SCRIPT_WEB_APP_URL = process.env.EXPO_PUBLIC_APPS_SCRIPT_URL ?? '';
function apiToken(): string {
  const session = getSession();
  if (!session?.token) throw new AuthError('請重新登入');
  return session.token;
}

/** True while no Apps Script URL is configured. */
export const isUsingMockApi = !APPS_SCRIPT_WEB_APP_URL;

type ApiResponse<T> = ({ ok: true } & T) | { ok: false; error: string };

const changeListeners = new Set<() => void>();

/**
 * Call `listener` after every successful write to the sheet (appointments, or
 * customer renames / deletes, which rewrite bookings too), e.g. to refresh
 * the home screen widget. Returns an unsubscribe function.
 */
export function onAppointmentsChanged(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

function notifyChanged(): void {
  for (const listener of changeListeners) listener();
}

/** This device's Expo push token, once registered (see notifications.ts). */
let senderPushToken: string | undefined;

/**
 * Remember this device's push token. It's sent with each booking and customer write, so
 * Apps Script tells only the other devices about the change.
 */
export function setSenderPushToken(token: string): void {
  senderPushToken = token;
}

/**
 * Add this device to the list Apps Script sends booking changes to (kept in
 * its script properties, not the sheet). Repeating it is harmless.
 */
export async function registerPushToken(input: {
  token: string;
  platform: string;
  device: string;
}): Promise<void> {
  if (isUsingMockApi) return;

  const res = await request(APPS_SCRIPT_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      token: apiToken(),
      action: 'registerPushToken',
      pushToken: input.token,
      platform: input.platform,
      device: input.device,
    }),
  });
  await parseResponse<object>(res);
}

export type ListAppointmentsOptions = {
  /** Only include appointments on/after this date (YYYY-MM-DD). */
  from?: string;
  /** Only include appointments on/before this date (YYYY-MM-DD). */
  to?: string;
};

/**
 * Fetch appointments (grouped on the client by date).
 */
export async function listAppointments(
  options: ListAppointmentsOptions = {}
): Promise<Appointment[]> {
  if (isUsingMockApi) {
    // Simulate a short network delay so loading UI can be tested
    await delay(300);
    return MOCK_APPOINTMENTS.filter(
      (apt) =>
        (!options.from || apt.date >= options.from) &&
        (!options.to || apt.date <= options.to)
    );
  }

  const params = new URLSearchParams({
    action: 'listAppointments',
    token: apiToken(),
  });
  if (options.from) params.set('from', options.from);
  if (options.to) params.set('to', options.to);

  const res = await request(`${APPS_SCRIPT_WEB_APP_URL}?${params.toString()}`);
  const data = await parseResponse<{ appointments: Appointment[] }>(res);
  return data.appointments;
}

/**
 * Fetch every appointment for one customer, past and upcoming, for the
 * history in 顧客資料. Rows that store the 顧客ID or the name both match.
 */
export async function listCustomerAppointments(key: CustomerKey): Promise<Appointment[]> {
  if (isUsingMockApi) {
    await delay(300);
    return MOCK_APPOINTMENTS.filter((apt) => apt.customerName === key.name);
  }

  const params = new URLSearchParams({
    action: 'listCustomerAppointments',
    token: apiToken(),
    name: key.name,
  });
  if (key.id) params.set('id', key.id);

  const res = await request(`${APPS_SCRIPT_WEB_APP_URL}?${params.toString()}`);
  const data = await parseResponse<{ appointments: Appointment[] }>(res);
  return data.appointments;
}

/** Fetch every booking with 完成作品, any date, for the 作品 tab. */
export async function listFinishedPhotoAppointments(): Promise<Appointment[]> {
  if (isUsingMockApi) {
    await delay(300);
    return MOCK_APPOINTMENTS.filter((apt) => (apt.finishedPhotos?.length ?? 0) > 0);
  }

  const params = new URLSearchParams({
    action: 'listFinishedPhotoAppointments',
    token: apiToken(),
  });
  const res = await request(`${APPS_SCRIPT_WEB_APP_URL}?${params.toString()}`);
  const data = await parseResponse<{ appointments: Appointment[] }>(res);
  return data.appointments;
}

/**
 * Create a new appointment — appends a row to 預約資料.
 */
export async function createAppointment(
  input: NewAppointmentInput,
  /** The new row's 預約ID; Apps Script returns the existing row if it already has it. */
  id?: string
): Promise<Appointment> {
  if (isUsingMockApi) {
    await delay(300);

    // Mock "created" record — not persisted; list still reads MOCK_APPOINTMENTS
    const created: Appointment = {
      id: id ?? `APT-MOCK-${Date.now()}`,
      customerName: input.customerName.trim(),
      date: input.date.trim(),
      time: input.time.trim(),
      service: input.service,
      notes: input.notes.trim(),
      durationMinutes: input.durationMinutes,
      handOrFoot: input.handOrFoot,
      price: input.price,
      deposit: input.deposit,
      keepDeposit: input.keepDeposit,
      complexDesign: input.complexDesign,
      removal: input.removal,
      extension: input.extension,
      status: input.service === '特別事項' ? '' : '預約',
    };

    console.log('[appointmentsApi] mock createAppointment:', created);
    return created;
  }

  // text/plain avoids a CORS preflight on web, which Apps Script can't answer.
  const res = await request(APPS_SCRIPT_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      token: apiToken(),
      action: 'createAppointment',
      pushToken: senderPushToken,
      id,
      appointment: input,
    }),
  });
  const data = await parseResponse<{ appointment: Appointment }>(res);
  notifyChanged();
  return data.appointment;
}

/**
 * Edit an existing appointment — overwrites its row in 預約資料 (found by 預約ID).
 */
export async function updateAppointment(
  id: string,
  input: UpdateAppointmentInput
): Promise<Appointment> {
  if (isUsingMockApi) {
    await delay(300);

    // Mock "updated" record — not persisted; list still reads MOCK_APPOINTMENTS
    const updated: Appointment = {
      id,
      customerName: input.customerName.trim(),
      date: input.date.trim(),
      time: input.time.trim(),
      service: input.service,
      notes: input.notes.trim(),
      durationMinutes: input.durationMinutes,
      handOrFoot: input.handOrFoot,
      price: input.price,
      deposit: input.deposit,
      keepDeposit: input.keepDeposit,
      complexDesign: input.complexDesign,
      removal: input.removal,
      extension: input.extension,
      status: input.status ?? '預約',
    };

    console.log('[appointmentsApi] mock updateAppointment:', updated);
    return updated;
  }

  const res = await request(APPS_SCRIPT_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      token: apiToken(),
      action: 'updateAppointment',
      pushToken: senderPushToken,
      id,
      appointment: input,
    }),
  });
  const data = await parseResponse<{ appointment: Appointment }>(res);
  notifyChanged();
  return data.appointment;
}

/**
 * Delete an appointment — removes its row from 預約資料 (found by 預約ID).
 */
export async function deleteAppointment(id: string): Promise<void> {
  if (isUsingMockApi) {
    await delay(300);
    // Not persisted; list still reads MOCK_APPOINTMENTS
    console.log('[appointmentsApi] mock deleteAppointment:', id);
    return;
  }

  const res = await request(APPS_SCRIPT_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      token: apiToken(),
      action: 'deleteAppointment',
      pushToken: senderPushToken,
      id,
    }),
  });
  await parseResponse<object>(res);
  notifyChanged();
}

/**
 * Save a photo to Drive and add its path to the booking's 參考作品 / 完成作品.
 * The path is chosen in the app, so sending it twice is harmless. Doesn't call
 * notifyChanged: nothing a photo changes reaches the widget or the reminders.
 */
export async function addAppointmentPhoto(
  id: string,
  kind: PhotoKind,
  path: string,
  base64: string
): Promise<void> {
  if (isUsingMockApi) {
    await delay(300);
    return;
  }

  const res = await request(APPS_SCRIPT_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      token: apiToken(),
      action: 'addAppointmentPhoto',
      id,
      kind,
      path,
      base64,
    }),
  });
  await parseResponse<object>(res);
}

/** Take a photo off a booking and move its file to Drive's trash. */
export async function removeAppointmentPhoto(
  id: string,
  kind: PhotoKind,
  path: string
): Promise<void> {
  if (isUsingMockApi) {
    await delay(300);
    return;
  }

  const res = await request(APPS_SCRIPT_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      token: apiToken(),
      action: 'removeAppointmentPhoto',
      id,
      kind,
      path,
    }),
  });
  await parseResponse<object>(res);
}

/** A photo's bytes as base64, as Drive's small preview or the full file. */
export async function getAppointmentPhoto(path: string, size: PhotoSize): Promise<string> {
  if (isUsingMockApi) {
    await delay(300);
    throw new Error('示範資料沒有相片');
  }

  const params = new URLSearchParams({
    action: 'getAppointmentPhoto',
    token: apiToken(),
    path,
    size,
  });
  const res = await request(`${APPS_SCRIPT_WEB_APP_URL}?${params.toString()}`);
  const data = await parseResponse<{ base64: string }>(res);
  return data.base64;
}

/**
 * Fetch all customers from the 顧客 sheet.
 */
export async function listCustomers(): Promise<Customer[]> {
  if (isUsingMockApi) {
    await delay(300);
    const byName = new Map<string, Customer>();
    for (const apt of MOCK_APPOINTMENTS) {
      if (byName.has(apt.customerName)) continue;
      byName.set(apt.customerName, {
        id: `CUST-MOCK-${byName.size + 1}`,
        name: apt.customerName,
        phone: apt.phone ?? '',
        joinedDate: '2025-03-01',
        ...(byName.size === 0 ? { instagram: 'https://www.instagram.com/instagram/' } : {}),
      });
    }
    return [...byName.values()];
  }

  const params = new URLSearchParams({
    action: 'listCustomers',
    token: apiToken(),
  });
  const res = await request(`${APPS_SCRIPT_WEB_APP_URL}?${params.toString()}`);
  const data = await parseResponse<{ customers: Customer[] }>(res);
  return data.customers;
}

/**
 * Fetch the nightly analysis results for 統計 (see analysis/ in the repo).
 * Empty until the script's ANALYSIS_SPREADSHEET_ID property is set.
 */
export async function listCustomerAnalytics(): Promise<CustomerAnalytics> {
  if (isUsingMockApi) {
    await delay(300);
    return mockCustomerAnalytics();
  }

  const params = new URLSearchParams({
    action: 'listCustomerAnalytics',
    token: apiToken(),
  });
  const res = await request(`${APPS_SCRIPT_WEB_APP_URL}?${params.toString()}`);
  return parseResponse<CustomerAnalytics>(res);
}

/**
 * Add a customer to 顧客. The script picks the 顧客ID.
 */
export async function createCustomer(input: CustomerInput): Promise<Customer> {
  if (isUsingMockApi) {
    await delay(300);
    // Not persisted; the list is rebuilt from MOCK_APPOINTMENTS
    const created: Customer = {
      id: `CUST-MOCK-${Date.now()}`,
      name: input.name.trim(),
      phone: sheetPhone(input.phone),
      joinedDate: todayIsoDate(),
      ...(input.source ? { source: input.source } : {}),
    };
    console.log('[appointmentsApi] mock createCustomer:', created);
    return created;
  }

  const res = await request(APPS_SCRIPT_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      token: apiToken(),
      action: 'createCustomer',
      pushToken: senderPushToken,
      customer: input,
    }),
  });
  const data = await parseResponse<{ customer: Customer }>(res);
  return data.customer;
}

/**
 * Edit a customer's name / phone in 顧客. Renaming also renames their
 * bookings that store the name, so they stay linked.
 */
export async function updateCustomer(
  key: CustomerKey,
  input: CustomerInput
): Promise<Customer> {
  if (isUsingMockApi) {
    await delay(300);
    // Not persisted; the list is rebuilt from MOCK_APPOINTMENTS
    const updated: Customer = {
      id: key.id ?? '',
      name: input.name.trim(),
      phone: sheetPhone(input.phone),
      ...(input.source ? { source: input.source } : {}),
    };
    console.log('[appointmentsApi] mock updateCustomer:', updated);
    return updated;
  }

  const res = await request(APPS_SCRIPT_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      token: apiToken(),
      action: 'updateCustomer',
      pushToken: senderPushToken,
      key,
      customer: input,
    }),
  });
  const data = await parseResponse<{ customer: Customer }>(res);
  notifyChanged();
  return data.customer;
}

/**
 * Delete a customer from 顧客. Their bookings are kept.
 */
export async function deleteCustomer(key: CustomerKey): Promise<void> {
  if (isUsingMockApi) {
    await delay(300);
    console.log('[appointmentsApi] mock deleteCustomer:', key);
    return;
  }

  const res = await request(APPS_SCRIPT_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      token: apiToken(),
      action: 'deleteCustomer',
      pushToken: senderPushToken,
      key,
    }),
  });
  await parseResponse<object>(res);
  notifyChanged();
}

/**
 * Longest wait for Apps Script. Android's networking has no timeout of its
 * own, so a request stalled on a bad connection would otherwise hang forever,
 * and with it every write queued behind it. Writes can wait up to 15 s for
 * the script's lock before their own work, hence the margin.
 */
const REQUEST_TIMEOUT_MS = 60_000;

/** No answer from Apps Script (offline, timed out): the write may or may not have happened. */
class ConnectionError extends Error {}

/** Signed out, or the server refused the session; the outbox keeps the write for after sign-in. */
export class AuthError extends Error {}

/**
 * Worth sending again: no answer came back, or the script gave up waiting for
 * its lock while the other phone was saving.
 */
export function isRetryable(e: unknown): boolean {
  // shortcut: matches Apps Script's English "Lock timeout" message; update if the script's locale changes it
  return e instanceof ConnectionError || (e instanceof Error && /lock/i.test(e.message));
}

/** fetch, giving up after REQUEST_TIMEOUT_MS. */
const responseSessions = new WeakMap<Response, Session | null>();

async function request(url: string, init?: RequestInit): Promise<Response> {
  const session = getSession();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    responseSessions.set(response, session);
    return response;
  } catch (e) {
    if (controller.signal.aborted) throw new ConnectionError('連線逾時，請檢查網絡後再試');
    throw new ConnectionError(e instanceof Error ? e.message : '連線失敗');
  } finally {
    clearTimeout(timer);
  }
}

/** Apps Script always replies 200; real errors come back as { ok: false }. */
async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`連線失敗（${res.status}）`);

  let data: ApiResponse<T>;
  try {
    data = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new Error('伺服器回應格式錯誤，請檢查 Apps Script 部署設定');
  }

  if (!data.ok) {
    if (data.error === 'Unauthorized') {
      if (responseSessions.get(res) === getSession()) signOut();
      throw new AuthError('請重新登入');
    }
    throw new Error(data.error);
  }
  return data;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

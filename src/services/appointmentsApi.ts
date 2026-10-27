/**
 * Appointment API layer — Google Apps Script Web App (see apps-script/).
 *
 * Configure in .env.local (see .env.example):
 *   EXPO_PUBLIC_APPS_SCRIPT_URL    the deployed /exec URL
 *   EXPO_PUBLIC_APPS_SCRIPT_TOKEN  must match the API_TOKEN script property
 *
 * When the URL is empty, falls back to mock data so the UI still runs.
 * Which spreadsheet is used (copy vs real) is decided by the script's
 * SPREADSHEET_ID property, not by the app.
 */

import { MOCK_APPOINTMENTS } from '@/data/mockAppointments';
import type {
  Appointment,
  NewAppointmentInput,
  UpdateAppointmentInput,
} from '@/types/appointment';
import type { Customer, CustomerInput, CustomerKey } from '@/types/customer';

const APPS_SCRIPT_WEB_APP_URL = process.env.EXPO_PUBLIC_APPS_SCRIPT_URL ?? '';
const APPS_SCRIPT_TOKEN = process.env.EXPO_PUBLIC_APPS_SCRIPT_TOKEN ?? '';

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
 * Remember this device's push token. It's sent with each booking write, so
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

  const res = await fetch(APPS_SCRIPT_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      token: APPS_SCRIPT_TOKEN,
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
    token: APPS_SCRIPT_TOKEN,
  });
  if (options.from) params.set('from', options.from);
  if (options.to) params.set('to', options.to);

  const res = await fetch(`${APPS_SCRIPT_WEB_APP_URL}?${params.toString()}`);
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
    token: APPS_SCRIPT_TOKEN,
    name: key.name,
  });
  if (key.id) params.set('id', key.id);

  const res = await fetch(`${APPS_SCRIPT_WEB_APP_URL}?${params.toString()}`);
  const data = await parseResponse<{ appointments: Appointment[] }>(res);
  return data.appointments;
}

/**
 * Create a new appointment — appends a row to 預約資料.
 */
export async function createAppointment(
  input: NewAppointmentInput
): Promise<Appointment> {
  if (isUsingMockApi) {
    await delay(300);

    // Mock "created" record — not persisted; list still reads MOCK_APPOINTMENTS
    const created: Appointment = {
      id: `APT-MOCK-${Date.now()}`,
      customerName: input.customerName.trim(),
      date: input.date.trim(),
      time: input.time.trim(),
      service: input.service,
      notes: input.notes.trim(),
      durationMinutes: input.durationMinutes,
      handOrFoot: input.handOrFoot,
      price: input.price,
      deposit: input.deposit,
      complexDesign: input.complexDesign,
      removal: input.removal,
      extension: input.extension,
      status: input.service === '特別事項' ? '' : '預約',
    };

    console.log('[appointmentsApi] mock createAppointment:', created);
    return created;
  }

  // text/plain avoids a CORS preflight on web, which Apps Script can't answer.
  const res = await fetch(APPS_SCRIPT_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      token: APPS_SCRIPT_TOKEN,
      action: 'createAppointment',
      pushToken: senderPushToken,
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
      complexDesign: input.complexDesign,
      removal: input.removal,
      extension: input.extension,
      status: input.status ?? '預約',
    };

    console.log('[appointmentsApi] mock updateAppointment:', updated);
    return updated;
  }

  const res = await fetch(APPS_SCRIPT_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      token: APPS_SCRIPT_TOKEN,
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

  const res = await fetch(APPS_SCRIPT_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      token: APPS_SCRIPT_TOKEN,
      action: 'deleteAppointment',
      pushToken: senderPushToken,
      id,
    }),
  });
  await parseResponse<object>(res);
  notifyChanged();
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
      });
    }
    return [...byName.values()];
  }

  const params = new URLSearchParams({
    action: 'listCustomers',
    token: APPS_SCRIPT_TOKEN,
  });
  const res = await fetch(`${APPS_SCRIPT_WEB_APP_URL}?${params.toString()}`);
  const data = await parseResponse<{ customers: Customer[] }>(res);
  return data.customers;
}

/**
 * Add a customer to 顧客. The script picks the 顧客ID.
 */
export async function createCustomer(input: CustomerInput): Promise<Customer> {
  if (isUsingMockApi) {
    await delay(300);
    // Not persisted; the list is rebuilt from MOCK_APPOINTMENTS
    const digits = input.phone.replace(/[^\d]/g, '');
    const created: Customer = {
      id: `CUST-MOCK-${Date.now()}`,
      name: input.name.trim(),
      phone: digits.length === 8 ? `852${digits}` : digits,
    };
    console.log('[appointmentsApi] mock createCustomer:', created);
    return created;
  }

  const res = await fetch(APPS_SCRIPT_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      token: APPS_SCRIPT_TOKEN,
      action: 'createCustomer',
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
    const digits = input.phone.replace(/[^\d]/g, '');
    const updated: Customer = {
      id: key.id ?? '',
      name: input.name.trim(),
      phone: digits.length === 8 ? `852${digits}` : digits,
    };
    console.log('[appointmentsApi] mock updateCustomer:', updated);
    return updated;
  }

  const res = await fetch(APPS_SCRIPT_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      token: APPS_SCRIPT_TOKEN,
      action: 'updateCustomer',
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

  const res = await fetch(APPS_SCRIPT_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      token: APPS_SCRIPT_TOKEN,
      action: 'deleteCustomer',
      key,
    }),
  });
  await parseResponse<object>(res);
  notifyChanged();
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

  if (!data.ok) throw new Error(data.error);
  return data;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

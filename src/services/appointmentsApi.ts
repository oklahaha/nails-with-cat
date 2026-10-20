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
import type { Appointment, NewAppointmentInput } from '@/types/appointment';
import type { Customer } from '@/types/customer';

const APPS_SCRIPT_WEB_APP_URL = process.env.EXPO_PUBLIC_APPS_SCRIPT_URL ?? '';
const APPS_SCRIPT_TOKEN = process.env.EXPO_PUBLIC_APPS_SCRIPT_TOKEN ?? '';

/** True while no Apps Script URL is configured. */
export const isUsingMockApi = !APPS_SCRIPT_WEB_APP_URL;

type ApiResponse<T> = ({ ok: true } & T) | { ok: false; error: string };

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
      status: '預約',
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
      appointment: input,
    }),
  });
  const data = await parseResponse<{ appointment: Appointment }>(res);
  return data.appointment;
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

/**
 * Appointment API layer — swap mock → Google Apps Script here.
 *
 * ----------------------------------------------------------------
 * HOW TO CONNECT TO GOOGLE SHEETS LATER
 * ----------------------------------------------------------------
 * 1. Keep your existing Apps Script app running (no need to stop it).
 * 2. Deploy a new (or extend the existing) Web App that returns JSON:
 *      doGet / doPost with actions like:
 *        ?action=listAppointments
 *        ?action=createAppointment  (POST body)
 * 3. Set APPS_SCRIPT_WEB_APP_URL below to your deployment URL.
 * 4. Replace the mock implementations with fetch() calls.
 * 5. Map sheet columns ↔ Appointment type in src/types/appointment.ts.
 *
 * Example (later):
 *   const res = await fetch(`${APPS_SCRIPT_WEB_APP_URL}?action=listAppointments`);
 *   const data = await res.json();
 *   return data.appointments as Appointment[];
 * ----------------------------------------------------------------
 */

import { MOCK_APPOINTMENTS } from '@/data/mockAppointments';
import type { Appointment, NewAppointmentInput } from '@/types/appointment';

/** Paste your Apps Script Web App URL here when ready. */
const APPS_SCRIPT_WEB_APP_URL = '';

/** Toggle when the real API is ready. Keep false while developing with mock data. */
const USE_REAL_API = false;

/**
 * Fetch all appointments (grouped on the client by date).
 * Today: returns mock data. Later: GET from Apps Script.
 */
export async function listAppointments(): Promise<Appointment[]> {
  if (USE_REAL_API && APPS_SCRIPT_WEB_APP_URL) {
    // TODO: replace with real fetch once Apps Script is deployed
    // const res = await fetch(`${APPS_SCRIPT_WEB_APP_URL}?action=listAppointments`);
    // if (!res.ok) throw new Error('Failed to load appointments');
    // const data = await res.json();
    // return data.appointments;
    throw new Error('Real API not implemented yet');
  }

  // Simulate a short network delay so loading UI can be tested
  await delay(300);
  return [...MOCK_APPOINTMENTS];
}

/**
 * Create a new appointment.
 * Today: logs + resolves. Later: POST to Apps Script → append row to 預約資料.
 */
export async function createAppointment(
  input: NewAppointmentInput
): Promise<Appointment> {
  if (USE_REAL_API && APPS_SCRIPT_WEB_APP_URL) {
    // TODO: POST JSON body to Apps Script
    // const res = await fetch(APPS_SCRIPT_WEB_APP_URL, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ action: 'createAppointment', ...input }),
    // });
    // if (!res.ok) throw new Error('Failed to create appointment');
    // return (await res.json()).appointment;
    throw new Error('Real API not implemented yet');
  }

  await delay(300);

  // Mock "created" record — not persisted; list still reads MOCK_APPOINTMENTS
  const created: Appointment = {
    id: `APT-MOCK-${Date.now()}`,
    customerName: input.customerName.trim(),
    date: input.date.trim(),
    time: input.time.trim(),
    service: input.service,
    notes: input.notes.trim(),
    status: '已預約',
  };

  console.log('[appointmentsApi] mock createAppointment:', created);
  return created;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

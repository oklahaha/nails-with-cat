/**
 * After a new booking is saved, ask whether to send the customer a WhatsApp
 * confirmation, without waiting for Apps Script (saves run in the background,
 * and a failure is reported on its own). The form closes on saving, so the
 * question is shown by WhatsAppConfirmationDialog in the root layout, one
 * booking at a time.
 */
import { useSyncExternalStore } from 'react';

import type { Appointment } from '@/types/appointment';
import { canSendConfirmation, confirmationMessage, openWhatsApp } from '@/utils/whatsapp';

/** Long enough for the form's modal to finish closing, so iOS can present the alert. */
const AFTER_FORM_CLOSES_MS = 600;

let waiting: Appointment[] = [];
const listeners = new Set<() => void>();

function setWaiting(next: Appointment[]): void {
  waiting = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Ask about a booking saveAppointment just made, once its form has closed; nothing without a phone. */
export function offerWhatsAppConfirmation(saved: Appointment): void {
  if (!canSendConfirmation(saved)) return;
  setTimeout(() => setWaiting([...waiting, saved]), AFTER_FORM_CLOSES_MS);
}

/** The booking to ask about now, if any. */
export function useWhatsAppConfirmation(): Appointment | undefined {
  return useSyncExternalStore(subscribe, () => waiting[0]);
}

/** Answer for `apt`: send the message, or 稍後. Once only; later calls are ignored. */
export function answerWhatsAppConfirmation(apt: Appointment, send: boolean): void {
  if (waiting[0] !== apt) return;
  setWaiting(waiting.slice(1));
  if (send) void openWhatsApp(apt.phone ?? '', confirmationMessage(apt));
}

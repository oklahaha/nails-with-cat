/**
 * After a booking is added or edited, ask whether to send the customer a WhatsApp
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
/** Offers still waiting for their form to close, by the save they were made for. */
const scheduled = new Map<Appointment, ReturnType<typeof setTimeout>>();
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
  scheduled.set(
    saved,
    setTimeout(() => {
      scheduled.delete(saved);
      setWaiting([...waiting.filter((apt) => apt.id !== saved.id), saved]);
    }, AFTER_FORM_CLOSES_MS)
  );
}

/**
 * Drop the offer made for this save (the object saveAppointment returned) once
 * it fails, so it can't send rolled-back details; a later save's offer stays.
 */
export function withdrawWhatsAppConfirmation(saved: Appointment): void {
  clearTimeout(scheduled.get(saved));
  scheduled.delete(saved);
  if (waiting.includes(saved)) setWaiting(waiting.filter((apt) => apt !== saved));
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

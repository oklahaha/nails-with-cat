import type { Appointment } from '@/types/appointment';

/**
 * Main label for an appointment. 特別事項 rows usually have no customer, so
 * fall back to 備注, then 活動.
 */
export function appointmentTitle(appointment: Appointment): string {
  return appointment.customerName || appointment.notes || appointment.service;
}

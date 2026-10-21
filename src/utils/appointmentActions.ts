import { router } from 'expo-router';

import type { Appointment } from '@/types/appointment';

/** Open the details screen, which offers WhatsApp, 修改 and 刪除. */
export function openAppointmentDetails(appointment: Appointment): void {
  router.push({ pathname: '/appointment-details', params: { id: appointment.id } });
}

import type { Appointment } from '@/types/appointment';
import { showAlert } from '@/utils/alert';
import { appointmentTitle } from '@/utils/appointmentTitle';
import { formatDateHeader } from '@/utils/groupByDate';
import { openWhatsApp, reminderMessage } from '@/utils/whatsapp';

/** Show an appointment's details, with a WhatsApp option when there's a phone. */
export function showAppointmentDetails(appointment: Appointment): void {
  const lines = [
    `${formatDateHeader(appointment.date)}`,
    `${appointment.time}${appointment.endTime && appointment.endTime !== appointment.time ? ` – ${appointment.endTime}` : ''}`,
    `活動：${appointment.service}`,
    appointment.handOrFoot ? `手/腳：${appointment.handOrFoot}` : null,
    appointment.price != null ? `收費：$${appointment.price}` : null,
    appointment.status ? `狀態：${appointment.status}` : null,
    appointment.notes ? `備注：${appointment.notes}` : null,
  ].filter(Boolean);

  const phone = appointment.phone;
  showAlert(
    appointmentTitle(appointment),
    lines.join('\n'),
    phone
      ? [
          { text: '關閉', style: 'cancel' },
          {
            text: 'WhatsApp',
            onPress: () => void openWhatsApp(phone, reminderMessage(appointment)),
          },
        ]
      : [{ text: '關閉' }]
  );
}

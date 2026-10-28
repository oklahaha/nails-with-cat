import * as Linking from 'expo-linking';

import type { Appointment } from '@/types/appointment';
import { showAlert } from '@/utils/alert';
import { formatDateHeader } from '@/utils/groupByDate';

/** Default reminder text sent when contacting a customer about a booking. */
export function reminderMessage(appointment: Appointment): string {
  return (
    `你好 ${appointment.customerName}！` +
    `提醒你預約：${appointment.date} ${appointment.time}（${appointment.service}）`
  );
}

/** Text sent to confirm a new booking with the customer. */
export function confirmationMessage(appointment: Appointment): string {
  const { customerName, date, time, endTime, service, handOrFoot, price } = appointment;
  const lines = [
    `你好 ${customerName}！你的預約已確認：`,
    `日期：${formatDateHeader(date)}`,
    `時間：${endTime && endTime !== time ? `${time}–${endTime}` : time}`,
    `項目：${service.includes('甲') && handOrFoot ? `${service}（${handOrFoot}）` : service}`,
    price ? `收費：$${price}` : null,
    '如需更改請回覆此訊息，謝謝！',
  ];
  return lines.filter(Boolean).join('\n');
}

/** Whether to offer the confirmation message after saving: new customer bookings with a phone. */
export function canSendConfirmation(appointment: Appointment): boolean {
  return appointment.service !== '特別事項' && Boolean(appointment.phone?.trim());
}

/**
 * Open WhatsApp chat for a phone number.
 * Uses https://wa.me/ so it works on device and web without custom URL schemes.
 *
 * Phone should be digits only, preferably with country code (e.g. 85291234567).
 */
export async function openWhatsApp(
  phone: string,
  message?: string
): Promise<void> {
  const cleaned = phone.replace(/[^\d]/g, '');
  if (!cleaned) {
    showAlert('無法開啟 WhatsApp', '沒有有效的電話號碼。');
    return;
  }

  const params = message
    ? `?text=${encodeURIComponent(message)}`
    : '';
  const url = `https://wa.me/${cleaned}${params}`;

  try {
    await Linking.openURL(url);
  } catch {
    showAlert('無法開啟 WhatsApp', '請確認裝置已安裝 WhatsApp。');
  }
}

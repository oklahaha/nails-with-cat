import * as Linking from 'expo-linking';

import type { Appointment } from '@/types/appointment';
import { showAlert } from '@/utils/alert';
import { formatDuration, parseIsoDate, WEEKDAY_LABELS } from '@/utils/dates';
import { formatDateHeader } from '@/utils/groupByDate';

/** The studio's 明天預約提醒 template, sent from the 預約資料 list the day before. */
export function reminderMessage(appointment: Appointment): string {
  const { date, time, endTime, durationMinutes } = appointment;
  const day = parseIsoDate(date);
  const when = isNaN(day.getTime())
    ? date
    : `${day.getMonth() + 1}月${day.getDate()}日（${WEEKDAY_LABELS[day.getDay()]}）`;
  const range = endTime && endTime !== time ? `${time}–${endTime}` : time;
  const duration = durationMinutes ? `（約${formatDuration(durationMinutes).replace(' ', '')}）` : '';
  return [
    '🐈Nails_with_cats_🐈‍⬛',
    '',
    '明天預約提醒⏰',
    `📅 ${when}${range}`,
    `📝 ${serviceLabel(appointment)}${duration}`,
    '',
    '⚠️ 請務必預留足夠時間！',
    '',
    '⏰ 記得準時喔！遲到15分鐘或以上會扣訂金💰',
    '',
    '收到請覆「OK」俾我哋～💓',
    '',
    'PS. 早到咗而前面客人未完成，麻煩喺29號門口坐一坐喔🫶🏻💕',
    '',
    '————————————',
    '📍:',
    '葵興E 出口的話可以不用曬太陽！',
    '經商場到九龍貿易中心後',
    '落地下嘅對面就系美和了',
    '',
    'Lift 嘅話只有右邊客lift可以到13樓',
    '到門口後按1329 加📞制就ok了',
    '',
    '29號室系直行尾二的💗',
    '有咩唔明到時call 我/ ws me 都可以！',
  ].join('\n');
}

/** e.g. 整甲（手）; 手/腳 only for nail services. */
function serviceLabel({ service, handOrFoot }: Appointment): string {
  return service.includes('甲') && handOrFoot ? `${service}（${handOrFoot}）` : service;
}

/** Text sent to confirm a new booking with the customer. */
export function confirmationMessage(appointment: Appointment): string {
  const { customerName, date, time, endTime, price } = appointment;
  const lines = [
    `你好 ${customerName}！你的預約已確認：`,
    `日期：${formatDateHeader(date)}`,
    `時間：${endTime && endTime !== time ? `${time}–${endTime}` : time}`,
    `項目：${serviceLabel(appointment)}`,
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

import * as Linking from 'expo-linking';

import type { Appointment } from '@/types/appointment';
import { showAlert } from '@/utils/alert';
import { formatDuration, parseIsoDate, WEEKDAY_LABELS } from '@/utils/dates';

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

/** The studio's 𝐀𝐩𝐩𝐨𝐢𝐧𝐭𝐦𝐞𝐧𝐭 𝐃𝐞𝐭𝐚𝐢𝐥𝐬 template, offered after a new booking is saved. */
export function confirmationMessage(appointment: Appointment): string {
  const { service, date, time, endTime, durationMinutes } = appointment;
  const day = parseIsoDate(date);
  const when = isNaN(day.getTime())
    ? date
    : `${day.getDate()}/${day.getMonth() + 1}（${WEEKDAY_LABELS[day.getDay()]}）`;
  const range = endTime && endTime !== time ? `${time}–${endTime}` : time;
  return [
    '𝐀𝐩𝐩𝐨𝐢𝐧𝐭𝐦𝐞𝐧𝐭 𝐃𝐞𝐭𝐚𝐢𝐥𝐬 🫧',
    '',
    '感謝你預約 nails_with_cats_✨',
    '確認訂金後才會預留位置',
    '',
    '🐈 麻煩再確認一下以下時間及注意事項喔 🐈‍⬛',
    '',
    `𝗗𝗮𝘁𝗲 & 𝗧𝗶𝗺𝗲：${when}${range}`,
    `𝗦𝗲𝗿𝘃𝗶𝗰𝗲：${service}`,
    durationMinutes ? `𝗗𝘂𝗿𝗮𝘁𝗶𝗼𝗻：約 ${formatDuration(durationMinutes)}` : null,
    '',
    '𝗟𝗼𝗰𝗮𝘁𝗶𝗼𝗻 📍（預約前一天會有提示🔔）',
    '葵涌葵昌路90號美和工業大廈13樓29號',
    '葵興 MTR E出口步行約 3 mins',
    '',
    '🧚🏻‍♂️ 注意事項 ✨',
    '',
    '🐈‍⬛ 請於48小時前確認款式',
    '🐈 請預留上述足夠時間完成美甲服務',
    '🐈‍⬛ 為保證服務質素，請務必準時到達',
    '🐈 遲到超過15分鐘，訂金會被扣除哦～',
    '🐈‍⬛ 如需更改日期及時間，請於3天前通知',
    '🐈 即日改期／取消或無故缺席，訂金全額扣除',
    '🐈‍⬛ 訂金不設退款，可保留3個月用於下次預約',
    '🐈 如指甲有受損／過短等狀況，請提前告知',
    '🐈‍⬛ 5天內免費售後（限非人為損壞如脫落；人為損壞／改款式另收費）',
    '🐈 指甲為手工藝術，不接受完美主義者',
    '',
    '如有任何爭議，nails_with_cats_ 保留最終決定權🤍',
    '',
    '訂金詳情見下一個 message👇 有咩唔明隨時問我哋～🐾',
  ]
    .filter((line) => line !== null)
    .join('\n');
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

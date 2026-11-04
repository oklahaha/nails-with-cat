import type { Appointment } from '@/types/appointment';
import { appointmentTitle } from '@/utils/appointmentTitle';
import { formatDateHeader } from '@/utils/groupByDate';

/** The WhatsApp confirmation question, shared by the iOS and Android / web alerts. */
export const confirmationQuestion = {
  title: '發送 WhatsApp 確認訊息？',
  message: (apt: Appointment) =>
    `已新增 ${appointmentTitle(apt)} ${formatDateHeader(apt.date)} ${apt.time} 的預約。要用 WhatsApp 通知顧客嗎？`,
};

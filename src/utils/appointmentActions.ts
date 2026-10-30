import { router } from 'expo-router';

import { usesDeposit } from '@/constants/services';
import { saveAppointmentStatus, saveKeepDeposit } from '@/hooks/appointmentWrites';
import { findCachedCustomer } from '@/hooks/useCustomers';
import { NO_SHOW, type Appointment } from '@/types/appointment';
import { showAlert } from '@/utils/alert';
import { appointmentTitle } from '@/utils/appointmentTitle';
import { formatDateHeader } from '@/utils/groupByDate';

/** Open the details screen, which offers WhatsApp, 修改 and 刪除. */
export function openAppointmentDetails(appointment: Appointment): void {
  router.push({ pathname: '/appointment-details', params: { id: appointment.id } });
}

/** Whether the long-press menus offer 顧客資料 and No show: customer bookings only. */
export function hasCustomerActions(appointment: Appointment): boolean {
  return appointment.service !== '特別事項' && appointment.customerName.trim() !== '';
}

/** The customer-details params for a booking's customer: 顧客ID when the list has loaded it. */
function customerParams(appointment: Appointment) {
  const name = appointment.customerName.trim();
  const customer = findCachedCustomer({ name });
  return customer?.id ? { id: customer.id, name } : { name };
}

/** Open the booking's customer in the customer-details sheet. */
export function openAppointmentCustomer(appointment: Appointment): void {
  router.push({ pathname: '/customer-details', params: customerParams(appointment) });
}

/** From the appointment details sheet (iOS): push 顧客資料 inside it, with a back button. */
export function pushAppointmentCustomer(appointment: Appointment): void {
  router.push({ pathname: '/appointment-details/customer', params: customerParams(appointment) });
}

/** Mark a booking No show, or (when it already is) back to 預約. Saved in the background. */
export function toggleNoShow(appointment: Appointment): void {
  saveAppointmentStatus(appointment, appointment.status === NO_SHOW ? '預約' : NO_SHOW);
}

/** The menu item's label for toggleNoShow. */
export function noShowLabel(appointment: Appointment): string {
  return appointment.status === NO_SHOW ? '取消 No show' : '標記 No show';
}

/**
 * Android's long-press menu: an alert with 顧客資料 and No show. Not used on
 * web, where showAlert can only offer one choice besides 取消.
 */
export function showAppointmentActions(appointment: Appointment): void {
  showAlert(
    appointmentTitle(appointment),
    `${formatDateHeader(appointment.date)} ${appointment.time} · ${appointment.service}`,
    [
      { text: '顧客資料', onPress: () => openAppointmentCustomer(appointment) },
      { text: noShowLabel(appointment), onPress: () => toggleNoShow(appointment) },
      { text: '取消', style: 'cancel' },
    ]
  );
}

/**
 * Whether the details offer 保留訂金: customer bookings whose 訂金 was paid,
 * except No show ones.
 */
export function canKeepDeposit(appointment: Appointment): boolean {
  return (
    hasCustomerActions(appointment) &&
    usesDeposit(appointment.service) &&
    appointment.deposit === true &&
    appointment.status !== NO_SHOW
  );
}

/** The 保留訂金 button's label and question, shared with the iOS button. */
export function keepDepositPrompt(appointment: Appointment) {
  const keep = !appointment.keepDeposit;
  return {
    keep,
    label: keep ? '保留訂金' : '取消保留訂金',
    title: keep ? '保留訂金？' : '取消保留訂金？',
    message: keep
      ? `${appointmentTitle(appointment)}\n訂金會保留到顧客下次預約，下次預約會顯示提示。`
      : `${appointmentTitle(appointment)}\n取消後，下次預約不會再顯示保留訂金提示。`,
    confirm: keep ? '保留' : '取消保留',
  };
}

/** 保留訂金 on Android and web: confirm, then save in the background. */
export function askKeepDeposit(appointment: Appointment, onDone: (saved: Appointment) => void): void {
  const prompt = keepDepositPrompt(appointment);
  showAlert(prompt.title, prompt.message, [
    { text: '取消', style: 'cancel' },
    { text: prompt.confirm, onPress: () => onDone(saveKeepDeposit(appointment, prompt.keep)) },
  ]);
}

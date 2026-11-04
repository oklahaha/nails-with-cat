import { useCustomerAppointments } from '@/hooks/useAppointments';
import { findCachedCustomer } from '@/hooks/useCustomers';
import type { Appointment } from '@/types/appointment';
import { hasCustomerActions } from '@/utils/appointmentActions';
import { formatShortDate } from '@/utils/dates';
import { previousKeptDeposit } from '@/utils/keptDeposit';

/**
 * 上次預約（…）保留了訂金, when the customer's booking before `apt` kept its
 * deposit (保留訂金), for the booking details. Loads the customer's history
 * (cached, shared with 顧客資料).
 */
export function useKeptDepositHint(apt: Appointment | undefined): string | undefined {
  const name = apt && hasCustomerActions(apt) ? apt.customerName.trim() : undefined;
  const id = name ? findCachedCustomer({ name })?.id || undefined : undefined;
  const history = useCustomerAppointments(name ? { id, name } : undefined);
  const kept = apt && name ? previousKeptDeposit(history.appointments, apt.date, apt.time, apt.id) : undefined;
  return kept ? `上次預約（${formatShortDate(kept.date)}）保留了訂金` : undefined;
}

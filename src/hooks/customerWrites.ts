/**
 * Customer adds, edits and deletes that don't make the user wait for Apps
 * Script, like appointmentWrites: the change shows at once and is sent in
 * the background, in order with the booking writes (writeQueue). A failed
 * write is undone and reported with an alert.
 *
 * A new customer has no 顧客ID until Apps Script returns one, so it's keyed
 * by name meanwhile; the script finds rows by name when the key has no id.
 */
import { renameCachedCustomer } from '@/hooks/useAppointments';
import { setPendingCustomer, settleCustomer } from '@/hooks/useCustomers';
import { enqueueWrite } from '@/hooks/writeQueue';
import {
  createCustomer,
  deleteCustomer,
  updateCustomer,
} from '@/services/appointmentsApi';
import type { Customer, CustomerInput, CustomerKey } from '@/types/customer';
import { showAlert } from '@/utils/alert';

function keyOf(customer: Customer): CustomerKey {
  return { id: customer.id || undefined, name: customer.name };
}

/** Phone as Apps Script reads it back: digits, with 852 before 8-digit numbers. */
function sheetPhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  return digits.length === 8 ? `852${digits}` : digits;
}

function reportFailure(action: string, name: string, e: unknown): void {
  showAlert(`${action}失敗`, `${name}\n${e instanceof Error ? e.message : '未知錯誤'}`);
}

/**
 * Add a customer, or edit `before`. Returns at once with the customer as
 * they'll be saved; the write runs in the background.
 */
export function saveCustomer(input: CustomerInput, before?: Customer): Customer {
  const local: Customer = {
    id: before?.id ?? '',
    name: input.name.trim(),
    phone: sheetPhone(input.phone),
  };

  if (before) {
    const key = keyOf(before);
    setPendingCustomer(key, local);
    renameCachedCustomer(before.name, local.name, local.phone);
    enqueueWrite(async () => {
      try {
        const saved = await updateCustomer(key, input);
        settleCustomer(key, saved);
        renameCachedCustomer(local.name, saved.name, saved.phone);
      } catch (e) {
        settleCustomer(keyOf(local), before);
        renameCachedCustomer(local.name, before.name, before.phone);
        reportFailure('儲存', before.name, e);
      }
    });
  } else {
    const key = keyOf(local);
    setPendingCustomer(key, local);
    enqueueWrite(async () => {
      try {
        settleCustomer(key, await createCustomer(input));
      } catch (e) {
        settleCustomer(key, null);
        reportFailure('新增顧客', local.name, e);
      }
    });
  }
  return local;
}

/** Delete a customer: they disappear at once, and come back if it fails. */
export function removeCustomer(customer: Customer): void {
  const key = keyOf(customer);
  setPendingCustomer(key, null);
  enqueueWrite(async () => {
    try {
      await deleteCustomer(key);
      settleCustomer(key, null);
    } catch (e) {
      settleCustomer(key, customer);
      reportFailure('刪除', customer.name, e);
    }
  });
}

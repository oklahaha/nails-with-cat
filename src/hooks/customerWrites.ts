/**
 * Customer adds, edits and deletes that don't make the user wait for Apps
 * Script, like appointmentWrites: the change shows at once and is sent in
 * the background, in order with the booking writes, and resent after a
 * restart if the app was closed first (writeQueue). A failed write is undone
 * and reported with an alert.
 *
 * A new customer has no 顧客ID until Apps Script returns one, so it's keyed
 * by name meanwhile; the script finds rows by name when the key has no id.
 */
import { renameCachedCustomer } from '@/hooks/useAppointments';
import { setPendingCustomer, settleCustomer } from '@/hooks/useCustomers';
import { defineWrite } from '@/hooks/writeQueue';
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

type SavePayload = {
  input: CustomerInput;
  /** The customer as shown while it's sent. */
  local: Customer;
  /** The customer before an edit; absent for a new one. */
  before?: Customer;
};

/** Show the save at once, while it's sent. */
function showSave({ local, before }: SavePayload): void {
  if (before) {
    setPendingCustomer(keyOf(before), local);
    renameCachedCustomer(before.name, local.name, local.phone);
  } else {
    setPendingCustomer(keyOf(local), local);
  }
}

const sendSave = defineWrite<SavePayload>('saveCustomer', {
  restore: showSave,
  run: async ({ input, local, before }) => {
    if (before) {
      const key = keyOf(before);
      try {
        const saved = await updateCustomer(key, input);
        settleCustomer(key, saved);
        renameCachedCustomer(local.name, saved.name, saved.phone);
      } catch (e) {
        settleCustomer(keyOf(local), before);
        renameCachedCustomer(local.name, before.name, before.phone);
        reportFailure('儲存', before.name, e);
      }
      return;
    }
    const key = keyOf(local);
    try {
      settleCustomer(key, await createCustomer(input));
    } catch (e) {
      settleCustomer(key, null);
      reportFailure('新增顧客', local.name, e);
    }
  },
});

const sendDelete = defineWrite<{ customer: Customer }>('deleteCustomer', {
  restore: ({ customer }) => setPendingCustomer(keyOf(customer), null),
  run: async ({ customer }) => {
    const key = keyOf(customer);
    try {
      await deleteCustomer(key);
      settleCustomer(key, null);
    } catch (e) {
      settleCustomer(key, customer);
      reportFailure('刪除', customer.name, e);
    }
  },
});

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
  const payload = { input, local, before };
  showSave(payload);
  sendSave(payload);
  return local;
}

/** Delete a customer: they disappear at once, and come back if it fails. */
export function removeCustomer(customer: Customer): void {
  setPendingCustomer(keyOf(customer), null);
  sendDelete({ customer });
}

/** 85291234567 → +852 9123 4567; other numbers are shown as stored. */
export function formatPhone(phone: string): string {
  const m = phone.match(/^852(\d{4})(\d{4})$/);
  return m ? `+852 ${m[1]} ${m[2]}` : phone;
}

/** Phone as Apps Script reads it back: digits, with 852 before 8-digit numbers. */
export function sheetPhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  return digits.length === 8 ? `852${digits}` : digits;
}

/** For editing: a Hong Kong number without the 852 the app adds on read. */
export function localPhone(phone: string): string {
  const m = phone.match(/^852(\d{8})$/);
  return m ? m[1] : phone;
}

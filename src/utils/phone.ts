/** 85291234567 → +852 9123 4567; other numbers are shown as stored. */
export function formatPhone(phone: string): string {
  const m = phone.match(/^852(\d{4})(\d{4})$/);
  return m ? `+852 ${m[1]} ${m[2]}` : phone;
}

/** For editing: a Hong Kong number without the 852 the app adds on read. */
export function localPhone(phone: string): string {
  const m = phone.match(/^852(\d{8})$/);
  return m ? m[1] : phone;
}

/**
 * The Google accounts allowed into the app. Anyone else who signs in with
 * Google is turned away on the sign-in screen.
 */
export const ALLOWED_EMAILS = [
  'heiheion@gmail.com',
  'alice17112000@gmail.com',
  'baoannie0703@gmail.com',
];

/** Google addresses are case-insensitive, so compare them lowercased. */
export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ALLOWED_EMAILS.includes(email.trim().toLowerCase());
}

export function notAllowedMessage(email: string | null | undefined): string {
  return `${email ?? '這個帳戶'} 不能使用這個 app，請用已登記的 Google 帳戶登入。`;
}

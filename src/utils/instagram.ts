import * as Linking from 'expo-linking';

import { showAlert } from '@/utils/alert';

/**
 * The profile name in a 顧客 IG cell, which AppSheet filled with links such
 * as https://www.instagram.com/name/ (some with ?igsh=… on the end); a bare
 * name or @name works too. Empty when there's none.
 */
export function instagramHandle(value: string | undefined): string {
  const text = (value ?? '').trim();
  const link = text.match(/instagram\.com\/([^/?#\s]+)/i);
  if (link) return link[1];
  return /^@?[\w.]+$/.test(text) ? text.replace(/^@/, '') : '';
}

/** The profile link for a 顧客 IG cell, or '' when it holds no profile. */
export function instagramUrl(value: string | undefined): string {
  const handle = instagramHandle(value);
  return handle ? `https://www.instagram.com/${handle}/` : '';
}

/** Open the profile, in the Instagram app when it's installed. */
export async function openInstagram(value: string | undefined): Promise<void> {
  const url = instagramUrl(value);
  if (!url) {
    showAlert('無法開啟 Instagram', '沒有有效的 IG 帳戶。');
    return;
  }
  try {
    await Linking.openURL(url);
  } catch {
    showAlert('無法開啟 Instagram', '請稍後再試。');
  }
}

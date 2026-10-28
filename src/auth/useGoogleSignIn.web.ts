/**
 * Web version of useGoogleSignIn.ts: @react-native-google-signin's web support
 * is sponsors-only, so the browser signs in through expo-auth-session instead
 * (an access token in a popup) and reads the email from Google's userinfo
 * endpoint. Limited to ALLOWED_EMAILS like the native version.
 */
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';

import { showAlert } from '@/utils/alert';

import { isAllowedEmail, notAllowedMessage } from './allowedEmails';
import { signIn } from './session';

// Closes the sign-in popup on web once Google redirects back to it
WebBrowser.maybeCompleteAuthSession();

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

/** Whether the web client ID is set; the provider throws without one. */
export const GOOGLE_SIGN_IN_CONFIGURED = Boolean(WEB_CLIENT_ID);

type Profile = { email?: string; email_verified?: boolean; name?: string };

async function fetchProfile(accessToken: string): Promise<Profile> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`userinfo ${res.status}`);
  return res.json();
}

/** Only call where GOOGLE_SIGN_IN_CONFIGURED is true. */
export function useGoogleSignIn() {
  const [request, , promptAsync] = Google.useAuthRequest({
    webClientId: WEB_CLIENT_ID,
    scopes: ['openid', 'email', 'profile'],
    // Always offer the account picker, so a refused account can switch to another
    selectAccount: true,
  });
  const [busy, setBusy] = useState(false);

  const start = async () => {
    if (!request || busy) return;
    setBusy(true);
    try {
      const result = await promptAsync();
      if (result.type === 'error') {
        showAlert('登入失敗', result.error?.description ?? '請再試一次');
        return;
      }
      // Cancelled or dismissed
      if (result.type !== 'success') return;

      const accessToken = result.authentication?.accessToken ?? result.params.access_token;
      if (!accessToken) throw new Error('no access token');

      const profile = await fetchProfile(accessToken);
      if (!profile.email_verified || !isAllowedEmail(profile.email)) {
        showAlert('沒有權限', notAllowedMessage(profile.email));
        return;
      }
      // The root layout's guard then shows the timetable
      signIn({ email: profile.email!.trim().toLowerCase(), name: profile.name });
    } catch {
      showAlert('登入失敗', '連線出錯，請再試一次');
    } finally {
      setBusy(false);
    }
  };

  return { ready: Boolean(request), busy, start };
}

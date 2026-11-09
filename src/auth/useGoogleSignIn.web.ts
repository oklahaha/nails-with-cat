/**
 * Web version of useGoogleSignIn.ts: @react-native-google-signin's web support
 * is sponsors-only, so the browser signs in through expo-auth-session instead
 * (an ID token in a popup) and exchanges it for a backend-verified session.
 */
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';

import { showAlert } from '@/utils/alert';

import { authenticate } from './session';

// Closes the sign-in popup on web once Google redirects back to it
WebBrowser.maybeCompleteAuthSession();

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

/** Whether the web client ID is set; the provider throws without one. */
export const GOOGLE_SIGN_IN_CONFIGURED = Boolean(WEB_CLIENT_ID);

/** Only call where GOOGLE_SIGN_IN_CONFIGURED is true. */
export function useGoogleSignIn() {
  const [request, , promptAsync] = Google.useIdTokenAuthRequest({
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

      const idToken = result.params.id_token;
      if (!idToken) throw new Error('Missing Google ID token');
      await authenticate(idToken);
    } catch {
      showAlert('登入失敗', '連線出錯，請再試一次');
    } finally {
      setBusy(false);
    }
  };

  return { ready: Boolean(request), busy, start };
}

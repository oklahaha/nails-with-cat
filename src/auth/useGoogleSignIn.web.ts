/**
 * Web version of useGoogleSignIn.ts: @react-native-google-signin's web support
 * is sponsors-only, so the browser goes to Google's sign-in page in the same
 * tab (no popup, which browsers often break or block) and comes back with an
 * ID token, which is exchanged for a backend-verified session.
 */
import { useEffect, useState } from 'react';

import { showAlert } from '@/utils/alert';

import { takeGoogleRedirect } from './googleRedirect';
import { authenticate } from './session';

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const STATE_KEY = 'google-sign-in-state';

/** Whether the web client ID is set. */
export const GOOGLE_SIGN_IN_CONFIGURED = Boolean(WEB_CLIENT_ID);

/** Only call where GOOGLE_SIGN_IN_CONFIGURED is true. */
export function useGoogleSignIn() {
  const [busy, setBusy] = useState(false);

  // Finishes a sign-in when the page is Google's redirect back
  useEffect(() => {
    const params = takeGoogleRedirect();
    if (!params) return;
    const expected = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    // The user backed out of Google's page
    if (params.get('error') === 'access_denied') return;
    const idToken = params.get('id_token');
    // A state we didn't send means the redirect didn't start here
    if (!idToken || !expected || params.get('state') !== expected) {
      showAlert('登入失敗', '請再試一次');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- once, on the way back from Google
    setBusy(true);
    authenticate(idToken)
      .catch(() => showAlert('登入失敗', '連線出錯，請再試一次'))
      .finally(() => setBusy(false));
  }, []);

  // Back from Google can restore this page from the back/forward cache, still busy
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) setBusy(false);
    };
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, []);

  const start = () => {
    if (busy) return;
    setBusy(true);
    const state = crypto.randomUUID();
    sessionStorage.setItem(STATE_KEY, state);
    const query = new URLSearchParams({
      client_id: WEB_CLIENT_ID!,
      redirect_uri: window.location.origin,
      response_type: 'id_token',
      scope: 'openid email profile',
      nonce: crypto.randomUUID(),
      state,
      // Always offer the account picker, so a refused account can switch to another
      prompt: 'select_account',
    });
    window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${query}`);
  };

  return { ready: true, busy, start };
}

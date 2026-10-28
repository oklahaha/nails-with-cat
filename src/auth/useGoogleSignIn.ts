/**
 * Google sign-in on iOS and Android through @react-native-google-signin
 * (Google's own native SDKs), limited to ALLOWED_EMAILS. Web uses
 * useGoogleSignIn.web.ts.
 */
import type * as GoogleSignInType from '@react-native-google-signin/google-signin';
import { useState } from 'react';
import { Platform, TurboModuleRegistry } from 'react-native';

import { showAlert } from '@/utils/alert';

import { isAllowedEmail, notAllowedMessage } from './allowedEmails';
import { signIn } from './session';

const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

// The library looks its native module up on import and throws without it
// (Expo Go, builds from before it was added), so load it only when present
const Google: typeof GoogleSignInType | null = TurboModuleRegistry.get('RNGoogleSignin')
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@react-native-google-signin/google-signin')
  : null;

/**
 * Whether sign-in can work here. iOS needs its own client ID (its reversed
 * form is also the URL scheme in app.config.ts); Android finds its client by
 * package name and signing key, and only needs one registered.
 */
export const GOOGLE_SIGN_IN_CONFIGURED = Boolean(Google && (Platform.OS !== 'ios' || IOS_CLIENT_ID));

Google?.GoogleSignin.configure({ iosClientId: IOS_CLIENT_ID });

/** Only call where GOOGLE_SIGN_IN_CONFIGURED is true. */
export function useGoogleSignIn() {
  const [busy, setBusy] = useState(false);

  const start = async () => {
    if (!Google || busy) return;
    const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = Google;
    setBusy(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      // Signs out of the Google SDK first, so the account picker always shows
      // and a refused account can switch to another
      await GoogleSignin.signOut();
      const response = await GoogleSignin.signIn();
      // Cancelled
      if (!isSuccessResponse(response)) return;

      const { email, name } = response.data.user;
      if (!isAllowedEmail(email)) {
        await GoogleSignin.signOut();
        showAlert('沒有權限', notAllowedMessage(email));
        return;
      }
      // The root layout's guard then shows the timetable
      signIn({ email: email.trim().toLowerCase(), name: name ?? undefined });
    } catch (error) {
      if (isErrorWithCode(error)) {
        if (error.code === statusCodes.SIGN_IN_CANCELLED || error.code === statusCodes.IN_PROGRESS) return;
        if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          showAlert('登入失敗', '這部手機沒有 Google Play 服務');
          return;
        }
      }
      showAlert('登入失敗', '連線出錯，請再試一次');
    } finally {
      setBusy(false);
    }
  };

  return { ready: GOOGLE_SIGN_IN_CONFIGURED, busy, start };
}

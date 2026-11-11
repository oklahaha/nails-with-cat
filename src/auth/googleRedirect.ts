/**
 * Web: Google's sign-in redirect comes back to the site's root with the ID
 * token in the URL hash. The root layout imports this module so the hash is
 * read at startup, before Stack.Protected moves the page to /sign-in and drops
 * it. Does nothing on iOS and Android.
 */
import { Platform } from 'react-native';

let pending: URLSearchParams | null = null;

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (params.has('state')) {
    pending = params;
    // Keep the token out of the address bar and history
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

/** Google's redirect parameters, once; null when the page didn't come from Google. */
export function takeGoogleRedirect(): URLSearchParams | null {
  const params = pending;
  pending = null;
  return params;
}

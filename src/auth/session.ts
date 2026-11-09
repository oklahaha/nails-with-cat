/**
 * The signed-in Google account. The root layout only lets the app's screens
 * through while `useSession()` returns one (`Stack.Protected`).
 */
import { useSyncExternalStore } from 'react';

import { isAllowedEmail } from './allowedEmails';
import { readSession, removeSession, writeSession } from './sessionStorage';

export type Session = { email: string; name?: string; token?: string; expiresAt?: number };

function loadSession(): Session | null {
  const raw = readSession();
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as Session;
    // Checked again so an account taken off the list loses access after an update
    return isAllowedEmail(session.email) &&
      (!process.env.EXPO_PUBLIC_APPS_SCRIPT_URL ||
        /^[a-f0-9]{64}$/.test(session.token ?? '')) ? session : null;
  } catch {
    return null;
  }
}

let current: Session | null = loadSession();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function signIn(session: Session): void {
  current = session;
  writeSession(JSON.stringify(session));
  emit();
}

export function getSession(): Session | null {
  // Expiry is the server's call (it slides on use); an Unauthorized reply signs out
  if (current && (!isAllowedEmail(current.email) ||
      (process.env.EXPO_PUBLIC_APPS_SCRIPT_URL && !current.token))) signOut();
  return current;
}

export async function authenticate(idToken: string): Promise<void> {
  const url = process.env.EXPO_PUBLIC_APPS_SCRIPT_URL;
  if (!url) throw new Error('Backend URL is required for Google sign-in');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, { method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'signIn', idToken }), signal: controller.signal });
    const data = await response.json();
    if (!response.ok || !data.ok || !isAllowedEmail(data.session?.email) ||
      !/^[a-f0-9]{64}$/.test(data.session?.token ?? '') ||
      !(data.session?.expiresAt > Date.now())) throw new Error('Sign-in refused');
    signIn(data.session);
  } finally { clearTimeout(timer); }
}

export function signOut(): void {
  const previous = current;
  if (previous?.token && process.env.EXPO_PUBLIC_APPS_SCRIPT_URL) {
    void fetch(process.env.EXPO_PUBLIC_APPS_SCRIPT_URL, { method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'signOut', token: previous.token }),
    }).catch(() => {});
  }
  current = null;
  removeSession();
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, () => current);
}

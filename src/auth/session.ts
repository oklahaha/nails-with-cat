/**
 * The signed-in Google account. The root layout only lets the app's screens
 * through while `useSession()` returns one (`Stack.Protected`).
 */
import { useSyncExternalStore } from 'react';

import { isAllowedEmail } from './allowedEmails';
import { readSession, removeSession, writeSession } from './sessionStorage';

export type Session = { email: string; name?: string };

function loadSession(): Session | null {
  const raw = readSession();
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as Session;
    // Checked again so an account taken off the list loses access after an update
    return isAllowedEmail(session.email) ? session : null;
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

export function signOut(): void {
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

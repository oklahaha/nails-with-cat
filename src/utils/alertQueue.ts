/**
 * Alerts waiting for a SwiftUI dialog on iOS (alert.ios.ts adds them,
 * AlertPresenter shows them), one at a time. Only the frontmost screen can
 * present, since iOS won't show an alert from a view under an open sheet, so
 * each modal registers a presenter on top of the root layout's.
 */
import type { AlertButton } from 'react-native';

export type QueuedAlert = {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
};

let nextId = 1;
let alerts: QueuedAlert[] = [];
let presenters: object[] = [];
const listeners = new Set<() => void>();

function changed(): void {
  for (const listener of listeners) listener();
}

export function subscribeAlerts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function enqueueAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  const shown = buttons && buttons.length > 0 ? buttons : [{ text: '確定' }];
  alerts = [...alerts, { id: nextId++, title, message, buttons: shown }];
  changed();
}

export function currentAlert(): QueuedAlert | undefined {
  return alerts[0];
}

/** Close `alert` and run the chosen button. Once only; later calls are ignored. */
export function answerAlert(alert: QueuedAlert, button: AlertButton): void {
  if (alerts[0] !== alert) return;
  alerts = alerts.slice(1);
  changed();
  button.onPress?.();
}

/** Returns the function that removes the presenter. The newest one presents. */
export function addAlertPresenter(presenter: object): () => void {
  presenters = [...presenters, presenter];
  changed();
  return () => {
    presenters = presenters.filter((p) => p !== presenter);
    changed();
  };
}

export function frontPresenter(): object | undefined {
  return presenters[presenters.length - 1];
}

import type { AlertButton } from 'react-native';

import { enqueueAlert } from './alertQueue';

/** Shown as a SwiftUI alert by AlertPresenter, whichever screen is in front. */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  enqueueAlert(title, message, buttons);
}

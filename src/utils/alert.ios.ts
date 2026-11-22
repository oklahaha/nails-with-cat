import type { AlertButton } from 'react-native';

import { enqueueAlert } from './alertQueue';

/**
 * Shown as a SwiftUI alert by AlertPresenter, whichever screen is in front.
 * Returns the function that takes it back.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): () => void {
  return enqueueAlert(title, message, buttons);
}

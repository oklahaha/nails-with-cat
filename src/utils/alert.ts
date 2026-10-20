import { Alert, type AlertButton, Platform } from 'react-native';

/**
 * Drop-in replacement for Alert.alert that also works on web.
 * react-native-web's Alert.alert is a no-op, so on web this falls back to
 * window.alert / window.confirm and still runs the button's onPress.
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[]
): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;
  const cancel = buttons?.find((b) => b.style === 'cancel');
  const confirm = buttons?.find((b) => b.style !== 'cancel');

  // Two choices (OK + cancel) map to confirm(); anything else to alert()
  if (cancel && confirm) {
    // confirm() only has OK / Cancel, so say what OK does
    if (window.confirm(`${text}\n\n按「確定」：${confirm.text}`)) confirm.onPress?.();
    else cancel.onPress?.();
    return;
  }

  window.alert(text);
  (confirm ?? cancel)?.onPress?.();
}

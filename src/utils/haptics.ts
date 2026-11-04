/**
 * Touch feedback for booking actions. Never throws or rejects: where haptics
 * aren't available (older builds without the native module, most browsers)
 * the action just goes ahead without it. Android uses the system's haptic
 * effects, which Expo recommends over its simulated vibrations.
 */
import {
  AndroidHaptics,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  impactAsync,
  notificationAsync,
  performAndroidHapticsAsync,
} from 'expo-haptics';
import { Platform } from 'react-native';

function play(android: AndroidHaptics, other: () => Promise<void>): void {
  // Confirm and Reject need Android 11; older phones get the vibration instead
  const played =
    Platform.OS === 'android' ? performAndroidHapticsAsync(android).catch(other) : other();
  played.catch(() => {});
}

/** A booking was saved. */
export function hapticSuccess(): void {
  play(AndroidHaptics.Confirm, () => notificationAsync(NotificationFeedbackType.Success));
}

/** Something went against the booking: it was deleted or marked No show. */
export function hapticWarning(): void {
  play(AndroidHaptics.Reject, () => notificationAsync(NotificationFeedbackType.Warning));
}

/** A small change, such as taking a booking's No show off. */
export function hapticLight(): void {
  play(AndroidHaptics.Context_Click, () => impactAsync(ImpactFeedbackStyle.Light));
}

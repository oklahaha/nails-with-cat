/**
 * Notifications on iOS and Android (expo-notifications):
 * - Local ones the phone schedules itself (localNotifications.ts): a
 *   reminder an hour before each booking and the morning summary. Every
 *   sync (useUpcomingSync) replaces them all.
 * - Push messages from Apps Script when the other user adds, edits or
 *   deletes a booking. This device registers its Expo push token with the
 *   script, and sends it with its own writes so it isn't told about them.
 *   Each change also comes with a silent push that wakes the app in the
 *   background to resync (backgroundSync.ts), so reminders follow bookings
 *   made on the other phone.
 * Tapping a notification about one booking opens its details.
 *
 * Remote push needs an EAS project ID and push credentials (see
 * apps-script/README.md); without the ID only the local notifications work.
 * Expo Go and dev builds made before expo-notifications was added don't
 * include its native module, and importing it would then throw at startup,
 * so it is only required once the module is known to exist (web has none).
 */
import { requireOptionalNativeModule } from 'expo';
import Constants from 'expo-constants';
import type * as NotificationsType from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { findCachedAppointment } from '@/hooks/useAppointments';
import { registerPushToken, setSenderPushToken } from '@/services/appointmentsApi';
import type { Appointment } from '@/types/appointment';

import {
  buildLocalNotifications,
  CHANNEL_CHANGES,
  CHANNEL_REMINDERS,
  type AppointmentNotificationData,
} from './localNotifications';

const Notifications: typeof NotificationsType | null = requireOptionalNativeModule(
  'ExpoNotificationScheduler'
)
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('expo-notifications')
  : null;

/** Show notifications as banners even while the app is open. */
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let channelsReady: Promise<unknown> | null = null;

/**
 * Android shows nothing for a notification whose channel doesn't exist, and
 * on Android 13+ the permission prompt waits for the first channel too.
 */
function ensureChannels(N: typeof NotificationsType): Promise<unknown> {
  channelsReady ??=
    Platform.OS === 'android'
      ? Promise.all([
          N.setNotificationChannelAsync(CHANNEL_REMINDERS, {
            name: '預約提醒',
            description: '預約前一小時及每朝的預約提示',
            importance: N.AndroidImportance.HIGH,
          }),
          N.setNotificationChannelAsync(CHANNEL_CHANGES, {
            name: '預約更新',
            description: '另一部手機新增、修改或刪除預約時通知',
            importance: N.AndroidImportance.HIGH,
          }),
        ])
      : Promise.resolve();
  return channelsReady;
}

// Each call replaces every scheduled notification, so they run one at a time
let scheduling: Promise<void> = Promise.resolve();
/**
 * What was last scheduled, so a sync that finds the same bookings leaves
 * them alone: replacing them all takes a call per notification, and a
 * background task cut short partway would leave reminders missing.
 */
let lastScheduled: string | undefined;

/** Replace the scheduled reminders and summaries with ones for `appointments`. */
export function scheduleLocalNotifications(appointments: Appointment[]): Promise<void> {
  const N = Notifications;
  if (!N) return Promise.resolve();
  const list = buildLocalNotifications(appointments);
  const signature = JSON.stringify(
    list.map((n) => [n.at.getTime(), n.title, n.body, n.data.appointmentId ?? ''])
  );

  scheduling = scheduling
    .then(async () => {
      if (signature === lastScheduled) return;
      // Cleared first: if scheduling fails partway, the next sync redoes it all
      lastScheduled = undefined;
      await ensureChannels(N);
      await N.cancelAllScheduledNotificationsAsync();
      for (const n of list) {
        await N.scheduleNotificationAsync({
          content: { title: n.title, body: n.body, data: n.data, sound: 'default' },
          trigger: {
            type: N.SchedulableTriggerInputTypes.DATE,
            date: n.at,
            channelId: CHANNEL_REMINDERS,
          },
        });
      }
      lastScheduled = signature;
    })
    .catch(() => {
      // Ignored: the next sync schedules them again
    });
  return scheduling;
}

/** Ask for permission (once), then register this device for push messages. */
async function setUpAsync(N: typeof NotificationsType): Promise<void> {
  await ensureChannels(N);
  let settings = await N.getPermissionsAsync();
  if (!settings.granted && settings.canAskAgain) settings = await N.requestPermissionsAsync();
  const allowed =
    settings.granted || settings.ios?.status === N.IosAuthorizationStatus.PROVISIONAL;
  if (!allowed) return;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    if (__DEV__) console.warn('[notifications] No EAS projectId; push messages are off');
    return;
  }
  const { data: token } = await N.getExpoPushTokenAsync({ projectId });
  setSenderPushToken(token);
  // Every launch, so the script's list recovers if it was cleared
  await registerPushToken({
    token,
    platform: Platform.OS,
    device: Constants.deviceName ?? '',
  });
}

// The tap that launched the app can arrive both ways; open it once
let lastOpened: string | undefined;

function openFromNotification(
  N: typeof NotificationsType,
  response: NotificationsType.NotificationResponse
): void {
  N.clearLastNotificationResponse();
  const key = `${response.notification.request.identifier}@${response.notification.date}`;
  if (key === lastOpened) return;
  lastOpened = key;
  const { appointmentId } = response.notification.request.content
    .data as AppointmentNotificationData;
  // The details screen only shows bookings that are already loaded
  if (appointmentId && findCachedAppointment(appointmentId)) {
    router.push({ pathname: '/appointment-details', params: { id: appointmentId } });
  }
}

/**
 * Called once in the root layout: asks for permission, registers for push,
 * and opens the booking when a notification is tapped (also one that
 * launched the app).
 */
export function useNotifications(): void {
  useEffect(() => {
    const N = Notifications;
    if (!N) return;

    setUpAsync(N).catch(() => {
      // Offline, or Apps Script failed: retried on the next launch
    });

    const launched = N.getLastNotificationResponse();
    if (launched) openFromNotification(N, launched);
    const subscription = N.addNotificationResponseReceivedListener((response) =>
      openFromNotification(N, response)
    );
    return () => subscription.remove();
  }, []);
}

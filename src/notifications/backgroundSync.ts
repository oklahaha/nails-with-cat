/**
 * Resyncs the reminders and the widget when a push arrives, also while the
 * app is in the background or not running: Apps Script sends a silent push
 * with every booking change (see notifications.ts). The OS may still delay
 * or skip these, in which case the next launch catches up.
 *
 * expo-task-manager starts the JS bundle without the UI to run the task, so
 * it has to be defined before the app loads: index.ts imports this first.
 */
import { requireOptionalNativeModule } from 'expo';
import type * as NotificationsType from 'expo-notifications';
import type * as TaskManagerType from 'expo-task-manager';

import { syncUpcoming } from '@/hooks/useUpcomingSync';

const BACKGROUND_SYNC_TASK = 'upcoming-sync';

// Missing in Expo Go, on web, and in dev builds made before these were added
if (
  requireOptionalNativeModule('ExpoTaskManager') &&
  requireOptionalNativeModule('ExpoBackgroundNotificationTasksModule')
) {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const TaskManager: typeof TaskManagerType = require('expo-task-manager');
  const Notifications: typeof NotificationsType = require('expo-notifications');
  /* eslint-enable @typescript-eslint/no-require-imports */

  TaskManager.defineTask<NotificationsType.NotificationTaskPayload>(
    BACKGROUND_SYNC_TASK,
    async ({ data }) => {
      // On Android the task also runs for taps, which notifications.ts handles
      if ('actionIdentifier' in data) return Notifications.BackgroundNotificationTaskResult.NoData;
      await syncUpcoming();
      return Notifications.BackgroundNotificationTaskResult.NewData;
    }
  );
  Notifications.registerTaskAsync(BACKGROUND_SYNC_TASK).catch(() => {
    // Ignored: reminders then catch up when the app is opened
  });
}

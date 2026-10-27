/**
 * Keeps what the phone shows outside the app up to date with the next two
 * weeks of bookings: the iOS 今日預約 widget (updateTodayWidget) and the
 * scheduled reminders and morning summaries (notifications.ts). Both only
 * know what the app last gave them, so this reloads from Apps Script:
 * - when the app starts,
 * - whenever it comes back to the foreground (the other user may have
 *   booked someone in the meantime),
 * - after every save or delete made in the app (onAppointmentsChanged),
 * - when a push says the other user changed a booking (backgroundSync.ts),
 *   even while the app is in the background.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { scheduleLocalNotifications } from '@/notifications/notifications';
import { listAppointments, onAppointmentsChanged } from '@/services/appointmentsApi';
import { addDays, todayIsoDate } from '@/utils/dates';
import { TIMELINE_DAYS } from '@/widgets/todayWidgetTimeline';
import { updateTodayWidget } from '@/widgets/updateTodayWidget';

let running: Promise<void> | null = null;
let again = false;

/**
 * Reload and update both. A call made while one is running waits for one
 * more round after it, so changes made meanwhile aren't missed.
 */
export function syncUpcoming(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      const today = todayIsoDate();
      try {
        // A week past the widget's timeline, so its last day still knows the next booking
        const appointments = await listAppointments({
          from: today,
          to: addDays(today, TIMELINE_DAYS + 7),
        });
        updateTodayWidget(appointments, today);
        await scheduleLocalNotifications(appointments);
      } catch {
        // Offline or Apps Script failed: keep what's there, retry on the next sync
      }
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Called once in the root layout. */
export function useUpcomingSync(): void {
  useEffect(() => {
    void syncUpcoming();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncUpcoming();
    });
    const unsubscribe = onAppointmentsChanged(() => void syncUpcoming());
    return () => {
      appState.remove();
      unsubscribe();
    };
  }, []);
}

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
 *
 * It loads the same range as the 預約資料 tab (everything from today), through
 * the shared cache, so the two share one Apps Script call per launch.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { loadAppointments } from '@/hooks/useAppointments';
import { scheduleLocalNotifications } from '@/notifications/notifications';
import { onAppointmentsChanged } from '@/services/appointmentsApi';
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
        const until = addDays(today, TIMELINE_DAYS + 7);
        const appointments = (await loadAppointments({ from: today })).filter(
          (apt) => apt.date <= until
        );
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

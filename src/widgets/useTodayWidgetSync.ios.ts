/**
 * Keeps the 今日預約 widget up to date (iOS; see TodayWidget.tsx).
 *
 * The widget only shows what the app last pushed to it, so this reloads the
 * next two weeks from Apps Script and rewrites the widget's timeline:
 * - when the app starts,
 * - whenever it comes back to the foreground (the other user may have
 *   booked someone in the meantime),
 * - after every save or delete made in the app (onAppointmentsChanged).
 * Between syncs the timeline itself moves the widget on at midnight and as
 * each booking starts.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { listAppointments, onAppointmentsChanged } from '@/services/appointmentsApi';
import { addDays, todayIsoDate } from '@/utils/dates';

import TodayWidget from './TodayWidget';
import { buildTodayWidgetTimeline, TIMELINE_DAYS } from './todayWidgetTimeline';

export function useTodayWidgetSync(): void {
  useEffect(() => {
    // Ignore responses from older syncs if they overlap
    let requestId = 0;

    async function sync() {
      const id = ++requestId;
      const today = todayIsoDate();
      try {
        // A week past the timeline, so the last day still knows the next booking
        const appointments = await listAppointments({
          from: today,
          to: addDays(today, TIMELINE_DAYS + 7),
        });
        if (id !== requestId) return;
        TodayWidget.updateTimeline(buildTodayWidgetTimeline(appointments, today));
      } catch {
        // Offline or Apps Script failed: keep the last timeline, retry on the next sync
      }
    }

    void sync();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });
    const unsubscribe = onAppointmentsChanged(() => void sync());
    return () => {
      appState.remove();
      unsubscribe();
    };
  }, []);
}

/**
 * Rewrites the 今日預約 widget's timeline (iOS; see TodayWidget.tsx) from
 * freshly loaded bookings. useUpcomingSync decides when: the widget only
 * shows what the app last pushed to it, and between syncs the timeline
 * itself moves the widget on at midnight and as each booking starts.
 *
 * Expo Go and dev builds made before expo-widgets was added don't include its
 * native module, and importing TodayWidget would then throw at startup, so it
 * is only required once the module is known to exist.
 */
import { requireOptionalNativeModule } from 'expo';

import type { Appointment } from '@/types/appointment';

import type TodayWidgetType from './TodayWidget';
import { buildTodayWidgetTimeline } from './todayWidgetTimeline';

const TodayWidget: typeof TodayWidgetType | null = requireOptionalNativeModule('ExpoWidgets')
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./TodayWidget').default
  : null;

/** `appointments` should cover `today` through a week past the timeline. */
export function updateTodayWidget(appointments: Appointment[], today: string): void {
  TodayWidget?.updateTimeline(buildTodayWidgetTimeline(appointments, today));
}

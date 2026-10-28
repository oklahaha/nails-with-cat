/**
 * The 時間表's pages on iOS in a SwiftUI page-style TabView, so a swipe drags
 * the next month / week / day in under the finger and snaps like iOS
 * Calendar. Each page hosts the React Native MonthView or TimeGrid. The pager
 * holds a window of pages around the anchor, recentred as the user nears its
 * ends or jumps away (今日, a day tapped in the month); only the page on
 * screen and its neighbours draw their grid, from the cache the screen
 * prefetches.
 */
import { Host, RNHostView, TabView } from '@expo/ui/swift-ui';
import { tabViewStyle } from '@expo/ui/swift-ui/modifiers';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MonthView } from '@/components/calendar/MonthView';
import { TimeGrid } from '@/components/calendar/TimeGrid';
import {
  groupByDateSorted,
  pageKey,
  shiftAnchor,
  timetableRange,
  type ViewMode,
} from '@/components/calendar/timetablePages';
import { colors } from '@/constants/theme';
import { useCachedAppointments } from '@/hooks/useAppointments';
import { openAppointmentDetails } from '@/utils/appointmentActions';
import { weekDates } from '@/utils/dates';

/** Pages each side of the window's centre. */
const RADIUS = 12;

type Props = {
  mode: ViewMode;
  anchor: string;
  onAnchorChange: (anchor: string) => void;
  onPressDay: (date: string) => void;
};

export function TimetablePager({ mode, anchor, onAnchorChange, onPressDay }: Props) {
  const [center, setCenter] = useState({ mode, anchor });
  const pages = useMemo(
    () =>
      Array.from({ length: RADIUS * 2 + 1 }, (_, i) => {
        const date = shiftAnchor(center.mode, center.anchor, i - RADIUS);
        return { date, key: pageKey(center.mode, date) };
      }),
    [center],
  );
  const selected = pageKey(mode, anchor);
  const index = pages.findIndex((page) => page.key === selected);
  // Recentre (during render, so the old window is never drawn for the new
  // mode) when the anchor jumps out of the window or comes near its ends
  if (center.mode !== mode || index < 2 || index > pages.length - 3) {
    setCenter({ mode, anchor });
  }

  return (
    <Host colorScheme="dark" seedColor={colors.accent} style={styles.pager}>
      <TabView
        selection={selected}
        onSelectionChange={(key) => {
          const to = pages.findIndex((page) => page.key === key);
          if (to !== -1 && to !== index) onAnchorChange(shiftAnchor(mode, anchor, to - index));
        }}
        modifiers={[tabViewStyle({ type: 'page', indexDisplayMode: 'never' })]}
      >
        {pages.map((page, i) => (
          <TabView.Tab key={page.key} value={page.key}>
            <RNHostView>
              <View style={styles.page}>
                {Math.abs(i - index) <= 1 ? (
                  <TimetablePage
                    mode={mode}
                    // The page on screen keeps the exact anchor (e.g. the day in a month)
                    date={i === index ? anchor : page.date}
                    onPressDay={onPressDay}
                  />
                ) : null}
              </View>
            </RNHostView>
          </TabView.Tab>
        ))}
      </TabView>
    </Host>
  );
}

function TimetablePage({
  mode,
  date,
  onPressDay,
}: {
  mode: ViewMode;
  date: string;
  onPressDay: (date: string) => void;
}) {
  const appointments = useCachedAppointments(timetableRange(date));
  const byDate = useMemo(() => groupByDateSorted(appointments), [appointments]);
  return mode === 'month' ? (
    <MonthView anchor={date} byDate={byDate} onPressDay={onPressDay} />
  ) : (
    <TimeGrid
      days={mode === 'week' ? weekDates(date) : [date]}
      byDate={byDate}
      onPressAppointment={openAppointmentDetails}
      onPressDay={onPressDay}
    />
  );
}

const styles = StyleSheet.create({
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

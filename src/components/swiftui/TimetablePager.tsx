/**
 * The 時間表's pages on iOS in a SwiftUI page-style TabView, so a swipe drags
 * the next month / week / day in under the finger and snaps like iOS
 * Calendar. The pager
 * holds a window of pages around the anchor, recentred as the user nears its
 * ends or jumps away (今日, a day tapped in the month); only the page on
 * screen and its neighbours draw their grid, from the cache the screen
 * prefetches.
 */
import { Spacer, TabView } from '@expo/ui/swift-ui';
import { onGeometryChange, tabViewStyle } from '@expo/ui/swift-ui/modifiers';
import { useMemo, useState } from 'react';

import {
  groupByDateSorted,
  pageKey,
  shiftAnchor,
  timetableRange,
  type ViewMode,
} from '@/components/calendar/timetablePages';
import { useCachedAppointments } from '@/hooks/useAppointments';
import { openAppointmentDetails } from '@/utils/appointmentActions';
import { weekDates } from '@/utils/dates';

import { MonthView } from './calendar/MonthView';
import { TimeGrid } from './calendar/TimeGrid';

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
  // The month fits itself to this height rather than scrolling
  const [height, setHeight] = useState(0);
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
    <TabView
      selection={selected}
      onSelectionChange={(key) => {
        const to = pages.findIndex((page) => page.key === key);
        if (to !== -1 && to !== index) onAnchorChange(shiftAnchor(mode, anchor, to - index));
      }}
      modifiers={[
        tabViewStyle({ type: 'page', indexDisplayMode: 'never' }),
        onGeometryChange((frame) => setHeight(frame.height)),
      ]}
    >
      {pages.map((page, i) => (
        <TabView.Tab key={page.key} value={page.key}>
          {Math.abs(i - index) <= 1 ? (
            <TimetablePage
              mode={mode}
              // The page on screen keeps the exact anchor (e.g. the day in a month)
              date={i === index ? anchor : page.date}
              onPressDay={onPressDay}
              height={height}
            />
          ) : (
            <Spacer />
          )}
        </TabView.Tab>
      ))}
    </TabView>
  );
}

function TimetablePage({
  mode,
  date,
  onPressDay,
  height,
}: {
  mode: ViewMode;
  date: string;
  onPressDay: (date: string) => void;
  height: number;
}) {
  const appointments = useCachedAppointments(timetableRange(date));
  const byDate = useMemo(() => groupByDateSorted(appointments), [appointments]);
  if (mode === 'month') {
    return <MonthView anchor={date} byDate={byDate} onPressDay={onPressDay} height={height} />;
  }
  const days = mode === 'week' ? weekDates(date) : [date];
  return (
    <TimeGrid
      key={days[0]}
      days={days}
      byDate={byDate}
      onPressAppointment={openAppointmentDetails}
      onPressDay={onPressDay}
    />
  );
}

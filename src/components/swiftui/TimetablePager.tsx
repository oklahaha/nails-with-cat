/**
 * The 時間表's pages on iOS in a SwiftUI page-style TabView, so a swipe drags
 * the next month / week / day in under the finger and snaps like iOS
 * Calendar. The pager
 * holds a window of pages around the anchor, recentred as the user nears its
 * ends or jumps away (今日, a day tapped in the month); only the page on
 * screen draws its grid at once and its neighbours follow shortly after, from
 * the cache the screen prefetches, since every SwiftUI element is a native view.
 */
import { Spacer, TabView, VStack } from '@expo/ui/swift-ui';
import { frame, onGeometryChange, tabViewStyle } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';

import {
  groupByDateSorted,
  pageKey,
  shiftAnchor,
  shouldDrawPage,
  timetableRange,
  type ViewMode,
} from '@/components/calendar/timetablePages';
import { useCachedAppointments } from '@/hooks/useAppointments';
import { openAppointmentDetails } from '@/utils/appointmentActions';
import { weekDates } from '@/utils/dates';

import { MonthView } from './calendar/MonthView';
import { TimeGrid } from './calendar/TimeGrid';

/** Pages each side of the window's centre. */
const RADIUS = 6;
/** After the page has opened and any swipe has finished. */
const NEIGHBOURS_AFTER_MS = 350;
/** Of the window, for the pages' height until it's measured, so they draw at once. */
const ESTIMATED_HEIGHT_SHARE = 0.68;

type Props = {
  mode: ViewMode;
  anchor: string;
  onAnchorChange: (anchor: string) => void;
  onPressDay: (date: string) => void;
};

export function TimetablePager({ mode, anchor, onAnchorChange, onPressDay }: Props) {
  const [center, setCenter] = useState({ mode, anchor });
  // The month fits itself to this height rather than scrolling
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const windowHeight = useWindowDimensions().height;
  const height = measuredHeight || windowHeight * ESTIMATED_HEIGHT_SHARE;
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

  const [settledKey, setSettledKey] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSettledKey(selected), NEIGHBOURS_AFTER_MS);
    return () => clearTimeout(timer);
  }, [selected]);
  const settled = pages.findIndex((page) => page.key === settledKey);

  return (
    <TabView
      selection={selected}
      onSelectionChange={(key) => {
        const to = pages.findIndex((page) => page.key === key);
        if (to !== -1 && to !== index) onAnchorChange(shiftAnchor(mode, anchor, to - index));
      }}
      modifiers={[
        tabViewStyle({ type: 'page', indexDisplayMode: 'never' }),
        onGeometryChange((geometry) => setMeasuredHeight(geometry.height)),
      ]}
    >
      {pages.map((page, i) => (
        <TabView.Tab key={page.key} value={page.key}>
          {/* Always here: TabView doesn't redraw when a Tab's own children change, only
              when its own props do, so what changes has to sit inside this stack */}
          <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
            {shouldDrawPage(i, index, settled) ? (
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
          </VStack>
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

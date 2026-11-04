/**
 * Month grid (iOS): one chip per appointment, coloured by service (活動). Every
 * booking shows and the month never scrolls: names are cut to one line, and
 * monthLayout sizes the weeks and chips to fit the screen. A legend below maps
 * colours to the services this month.
 *
 * Every SwiftUI element here is a native view, about 40 a week, so keep days
 * flat: no wrappers, and grid lines from a gap rather than their own views.
 */
import { HStack, RoundedRectangle, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  accessibilityElement,
  accessibilityLabel,
  background,
  clipShape,
  clipped,
  contentShape,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  onTapGesture,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';

import {
  layoutMonth,
  LEGEND_ROW_GAP,
  WEEKDAY_ROW_HEIGHT,
  type MonthLayout,
} from '@/components/calendar/monthLayout';
import { serviceColor } from '@/constants/services';
import { colors, radius, spacing } from '@/constants/theme';
import { useNow } from '@/hooks/useNow';
import type { Appointment } from '@/types/appointment';
import { appointmentTitle } from '@/utils/appointmentTitle';
import { isSameMonth, monthGrid, toIsoDate, WEEKDAY_LABELS } from '@/utils/dates';

import { Hairline } from './Hairline';

const LEGEND_PER_ROW = 3;
const GRID_LINE = 1 / 3;
/** Between the day number and its first booking. */
const BADGE_GAP = 2;

type Props = {
  /** Any date in the month to show. */
  anchor: string;
  /** Appointments keyed by date, each list sorted by time. */
  byDate: Map<string, Appointment[]>;
  onPressDay: (date: string) => void;
  /** Height the month has on screen. */
  height: number;
};

export function MonthView({ anchor, byDate, onPressDay, height }: Props) {
  const weeks = monthGrid(anchor);
  // Moves the today marker on at midnight while the screen stays open
  const today = toIsoDate(useNow());

  const legendRows = chunk(servicesInMonth(weeks, anchor, byDate), LEGEND_PER_ROW);
  const chipsPerWeek = weeks.map((week) =>
    Math.max(...week.map((date) => byDate.get(date)?.length ?? 0)),
  );
  const layout = layoutMonth(height, chipsPerWeek, legendRows.length);

  return (
    <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}>
      <HStack spacing={0} modifiers={[frame({ minHeight: WEEKDAY_ROW_HEIGHT, maxHeight: WEEKDAY_ROW_HEIGHT })]}>
        {WEEKDAY_LABELS.map((label, i) => (
          <Text
            key={label}
            modifiers={[
              font({ size: 12, weight: 'semibold' }),
              foregroundStyle(i === 0 || i === 6 ? colors.accent : colors.textSecondary),
              frame({ maxWidth: Infinity }),
            ]}
          >
            {label}
          </Text>
        ))}
      </HStack>

      <Hairline axis="horizontal" />
      {weeks.map((week, i) => (
        <HStack
          key={week[0]}
          spacing={0}
          alignment="top"
          modifiers={[
            frame({ minHeight: layout.weekHeights[i], maxHeight: layout.weekHeights[i] }),
            // Shows through the gap each day leaves: grid lines without a view for each
            background(colors.border),
          ]}
        >
          {week.map((date) => (
            <Day
              key={date}
              date={date}
              appointments={byDate.get(date) ?? []}
              inMonth={isSameMonth(date, anchor)}
              isToday={date === today}
              layout={layout}
              onPress={onPressDay}
            />
          ))}
        </HStack>
      ))}
      <Legend rows={legendRows} height={layout.footerHeight} />
    </VStack>
  );
}

type DayProps = {
  date: string;
  appointments: Appointment[];
  inMonth: boolean;
  isToday: boolean;
  layout: MonthLayout;
  onPress: (date: string) => void;
};

function Day({ date, appointments, inMonth, isToday, layout, onPress }: DayProps) {
  const names = appointments.map(appointmentTitle);
  return (
    <VStack
      spacing={layout.chipGap}
      modifiers={[
        padding({ top: spacing.xs, leading: 2, trailing: 2, bottom: 2 }),
        frame({ minWidth: 0, maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' }),
        clipped(),
        background(colors.background),
        padding({ trailing: GRID_LINE, bottom: GRID_LINE }),
        contentShape(shapes.rectangle()),
        onTapGesture(() => onPress(date)),
        accessibilityElement('ignore'),
        // Names are cut on screen, so VoiceOver reads them whole
        accessibilityLabel(`${date}，${appointments.length} 個預約${names.length ? `：${names.join('、')}` : ''}`),
        accessibilityAddTraits(['isButton']),
      ]}
    >
      <Text
        modifiers={[
          font({ size: 13, weight: isToday ? 'bold' : 'medium' }),
          monospacedDigit(),
          foregroundStyle(isToday ? colors.onAccent : inMonth ? colors.text : colors.textTertiary),
          frame({ width: 26, height: 26 }),
          ...(isToday ? [background(colors.accent), clipShape('circle')] : []),
          padding({ bottom: Math.max(BADGE_GAP - layout.chipGap, 0) }),
        ]}
      >
        {String(Number(date.slice(8)))}
      </Text>
      {appointments.map((apt, i) => (
        <Text
          key={apt.id}
          modifiers={[
            font({ size: layout.fontSize, weight: 'semibold' }),
            foregroundStyle(colors.onService),
            lineLimit(1),
            padding({ horizontal: 2 }),
            frame({
              minWidth: 0,
              maxWidth: Infinity,
              minHeight: layout.chipHeight,
              maxHeight: layout.chipHeight,
              alignment: 'leading',
            }),
            background(serviceColor(apt.service)),
            clipShape('roundedRectangle', radius.xs),
          ]}
        >
          {layout.fontSize > 0 ? names[i] : ''}
        </Text>
      ))}
    </VStack>
  );
}

function Legend({ rows, height }: { rows: string[][]; height: number }) {
  return (
    <VStack
      spacing={LEGEND_ROW_GAP}
      alignment="leading"
      modifiers={[
        // Room on the right for the floating add button
        padding({ top: spacing.sm, bottom: spacing.sm, leading: spacing.md, trailing: 88 }),
        frame({ maxWidth: Infinity, minHeight: height, maxHeight: height, alignment: 'topLeading' }),
      ]}
    >
      {rows.map((row) => (
        <HStack key={row[0]} spacing={spacing.sm}>
          {row.map((service) => (
            <HStack key={service} spacing={spacing.xs}>
              <RoundedRectangle
                cornerRadius={2}
                modifiers={[frame({ width: 10, height: 10 }), foregroundStyle(serviceColor(service))]}
              />
              <Text modifiers={[font({ size: 12 }), foregroundStyle(colors.textSecondary), lineLimit(1)]}>
                {service}
              </Text>
            </HStack>
          ))}
        </HStack>
      ))}
    </VStack>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

/** Distinct services booked in the anchor's month, in first-seen order. */
function servicesInMonth(
  weeks: string[][],
  anchor: string,
  byDate: Map<string, Appointment[]>,
): string[] {
  const seen = new Set<string>();
  for (const date of weeks.flat()) {
    if (!isSameMonth(date, anchor)) continue;
    for (const apt of byDate.get(date) ?? []) seen.add(apt.service);
  }
  return [...seen];
}

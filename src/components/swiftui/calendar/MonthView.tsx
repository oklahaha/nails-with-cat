/**
 * Month grid (iOS): one chip per appointment, coloured by service (活動). Every
 * booking shows and the month never scrolls: names are cut to one line, and
 * monthLayout sizes the weeks and chips to fit the screen. A legend below maps
 * colours to the services this month.
 */
import { Button, HStack, RoundedRectangle, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  background,
  buttonStyle,
  clipShape,
  clipped,
  contentShape,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
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

type Props = {
  /** Any date in the month to show. */
  anchor: string;
  /** Appointments keyed by date, each list sorted by time. */
  byDate: Map<string, Appointment[]>;
  onPressDay: (date: string) => void;
  /** Height the month has on screen, 0 until it's measured. */
  height: number;
};

export function MonthView({ anchor, byDate, onPressDay, height }: Props) {
  const weeks = monthGrid(anchor);
  // Moves the today marker on at midnight while the screen stays open
  const today = toIsoDate(useNow());

  if (height <= 0) return <Spacer />;

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

      {weeks.map((week, i) => (
        <VStack key={week[0]} spacing={0}>
          <Hairline axis="horizontal" />
          <HStack
            spacing={0}
            alignment="top"
            modifiers={[frame({ minHeight: layout.weekHeights[i], maxHeight: layout.weekHeights[i] })]}
          >
            {week.map((date) => (
              <HStack key={date} spacing={0} alignment="top">
                <Day
                  date={date}
                  appointments={byDate.get(date) ?? []}
                  inMonth={isSameMonth(date, anchor)}
                  isToday={date === today}
                  layout={layout}
                  onPress={onPressDay}
                />
                <Hairline axis="vertical" />
              </HStack>
            ))}
          </HStack>
        </VStack>
      ))}
      <Hairline axis="horizontal" />
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
    <Button
      onPress={() => onPress(date)}
      modifiers={[
        buttonStyle('plain'),
        // Names are cut on screen, so VoiceOver reads them whole
        accessibilityLabel(`${date}，${appointments.length} 個預約${names.length ? `：${names.join('、')}` : ''}`),
      ]}
    >
      <VStack
        spacing={2}
        modifiers={[
          padding({ top: spacing.xs, leading: 2, trailing: 2, bottom: 2 }),
          frame({ minWidth: 0, maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' }),
          clipped(),
          contentShape(shapes.rectangle()),
        ]}
      >
        <Text
          modifiers={[
            font({ size: 13, weight: isToday ? 'bold' : 'medium' }),
            monospacedDigit(),
            foregroundStyle(isToday ? colors.onAccent : inMonth ? colors.text : colors.textTertiary),
            frame({ width: 26, height: 26 }),
            ...(isToday ? [background(colors.accent), clipShape('circle')] : []),
          ]}
        >
          {String(Number(date.slice(8)))}
        </Text>
        {appointments.length > 0 ? (
          <VStack spacing={layout.chipGap}>
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
        ) : null}
      </VStack>
    </Button>
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

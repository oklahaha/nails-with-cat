import { Pressable, StyleSheet, Text, View } from 'react-native';

import { serviceColor } from '@/constants/services';
import { colors, radius, spacing } from '@/constants/theme';
import type { Appointment } from '@/types/appointment';
import { appointmentTitle } from '@/utils/appointmentTitle';
import { isSameMonth, monthGrid, todayIsoDate, WEEKDAY_LABELS } from '@/utils/dates';

/** Name chips shown per day before collapsing the rest into "+N". */
const MAX_BARS = 3;

type Props = {
  /** Any date in the month to show. */
  anchor: string;
  /** Appointments keyed by date, each list sorted by time. */
  byDate: Map<string, Appointment[]>;
  onPressDay: (date: string) => void;
};

/**
 * Month grid like the AppSheet 時間表: one chip per appointment showing the
 * customer's name, coloured by service (活動). A legend below maps colours to
 * the services that appear this month.
 */
export function MonthView({ anchor, byDate, onPressDay }: Props) {
  const weeks = monthGrid(anchor);
  const today = todayIsoDate();
  const services = servicesInMonth(weeks, anchor, byDate);

  return (
    <View style={styles.container}>
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <Text key={label} style={[styles.weekday, (i === 0 || i === 6) && styles.weekend]}>
            {label}
          </Text>
        ))}
      </View>

      {weeks.map((week) => (
        <View key={week[0]} style={styles.week}>
          {week.map((date) => {
            const apts = byDate.get(date) ?? [];
            const inMonth = isSameMonth(date, anchor);
            const isToday = date === today;
            const extra = apts.length - MAX_BARS;

            return (
              <Pressable
                key={date}
                style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
                onPress={() => onPressDay(date)}
                accessibilityRole="button"
                accessibilityLabel={`${date}，${apts.length} 個預約`}
              >
                <View style={[styles.dayBadge, isToday && styles.dayBadgeToday]}>
                  <Text
                    style={[
                      styles.dayText,
                      !inMonth && styles.dayTextOutside,
                      isToday && styles.dayTextToday,
                    ]}
                  >
                    {String(Number(date.slice(8)))}
                  </Text>
                </View>

                <View style={styles.bars}>
                  {apts.slice(0, MAX_BARS).map((apt) => (
                    <View
                      key={apt.id}
                      style={[styles.bar, { backgroundColor: serviceColor(apt.service) }]}
                    >
                      <Text style={styles.barText} numberOfLines={1}>
                        {appointmentTitle(apt)}
                      </Text>
                    </View>
                  ))}
                  {extra > 0 ? <Text style={styles.more}>+{extra}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}

      {services.length > 0 ? (
        <View style={styles.legend}>
          {services.map((service) => (
            <View key={service} style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: serviceColor(service) }]} />
              <Text style={styles.legendText}>{service}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  weekdayRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  weekend: {
    color: colors.accent,
  },
  week: {
    flex: 1,
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.xs,
    overflow: 'hidden',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cellPressed: {
    backgroundColor: colors.surfaceRaised,
  },
  dayBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeToday: {
    backgroundColor: colors.accent,
  },
  dayText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  dayTextOutside: {
    color: colors.textTertiary,
  },
  dayTextToday: {
    color: colors.onAccent,
    fontWeight: '700',
  },
  bars: {
    alignSelf: 'stretch',
    paddingHorizontal: 2,
    marginTop: 2,
    gap: 2,
  },
  bar: {
    borderRadius: radius.xs,
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  barText: {
    color: colors.onService,
    fontSize: 10,
    fontWeight: '600',
  },
  more: {
    color: colors.textSecondary,
    fontSize: 10,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    // Leave room for the floating add button
    paddingRight: 88,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
});

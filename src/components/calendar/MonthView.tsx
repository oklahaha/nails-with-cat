import { Pressable, StyleSheet, Text, View } from 'react-native';

import { serviceColor } from '@/constants/services';
import { colors, spacing } from '@/constants/theme';
import type { Appointment } from '@/types/appointment';
import { isSameMonth, monthGrid, todayIsoDate, WEEKDAY_LABELS } from '@/utils/dates';

/** Bars shown per day before collapsing the rest into "+N". */
const MAX_BARS = 3;

type Props = {
  /** Any date in the month to show. */
  anchor: string;
  /** Appointments keyed by date, each list sorted by time. */
  byDate: Map<string, Appointment[]>;
  onPressDay: (date: string) => void;
};

/**
 * Month grid like the AppSheet 時間表: one coloured bar per appointment,
 * coloured by service (活動).
 */
export function MonthView({ anchor, byDate, onPressDay }: Props) {
  const weeks = monthGrid(anchor);
  const today = todayIsoDate();

  return (
    <View style={styles.container}>
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} style={styles.weekday}>
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
                    />
                  ))}
                  {extra > 0 ? <Text style={styles.more}>+{extra}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
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
    color: colors.text,
    fontSize: 13,
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
  },
  dayTextOutside: {
    color: colors.textSecondary,
    opacity: 0.5,
  },
  dayTextToday: {
    color: colors.onAccent,
    fontWeight: '700',
  },
  bars: {
    alignSelf: 'stretch',
    paddingHorizontal: 3,
    marginTop: 2,
    gap: 2,
  },
  bar: {
    height: 4,
    borderRadius: 2,
  },
  more: {
    color: colors.textSecondary,
    fontSize: 10,
    textAlign: 'center',
  },
});

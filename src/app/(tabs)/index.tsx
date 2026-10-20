/**
 * 時間表 tab (home) — Day / Week / Month calendar, modelled on the AppSheet
 * timetable (reference/timetable.png). Tapping a day opens it in Day view.
 */
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddButton } from '@/components/AddButton';
import { MonthView } from '@/components/calendar/MonthView';
import { TimeGrid } from '@/components/calendar/TimeGrid';
import { Icon } from '@/components/Icon';
import { colors, radius, spacing } from '@/constants/theme';
import { useAppointments } from '@/hooks/useAppointments';
import type { Appointment } from '@/types/appointment';
import { showAppointmentDetails } from '@/utils/appointmentActions';
import {
  addDays,
  addMonths,
  formatMonthTitle,
  formatWeekTitle,
  monthGrid,
  todayIsoDate,
  weekDates,
} from '@/utils/dates';
import { formatDateHeader } from '@/utils/groupByDate';

type ViewMode = 'day' | 'week' | 'month';

const VIEW_MODES: { mode: ViewMode; label: string }[] = [
  { mode: 'day', label: 'Day' },
  { mode: 'week', label: 'Week' },
  { mode: 'month', label: 'Month' },
];

export default function TimetableScreen() {
  const [mode, setMode] = useState<ViewMode>('month');
  const [anchor, setAnchor] = useState(todayIsoDate);

  // Fetch the whole month grid (plus the anchor's week, which can spill into
  // the next month), so switching Day/Week/Month within a month doesn't refetch.
  const range = useMemo(() => {
    const grid = monthGrid(anchor);
    const week = weekDates(anchor);
    const from = week[0] < grid[0][0] ? week[0] : grid[0][0];
    const last = grid[grid.length - 1][6];
    const to = week[6] > last ? week[6] : last;
    return { from, to };
  }, [anchor]);

  const { appointments, loading, reloading, error, reload } = useAppointments(range);

  const byDate = useMemo(() => groupByDateSorted(appointments), [appointments]);

  const step = (direction: 1 | -1) => {
    if (mode === 'month') setAnchor(addMonths(anchor, direction));
    else setAnchor(addDays(anchor, direction * (mode === 'week' ? 7 : 1)));
  };

  const openDay = (date: string) => {
    setAnchor(date);
    setMode('day');
  };

  const title =
    mode === 'month'
      ? formatMonthTitle(anchor)
      : mode === 'week'
        ? formatWeekTitle(anchor)
        : formatDateHeader(anchor);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <View style={styles.modeTabs}>
          {VIEW_MODES.map(({ mode: m, label }) => {
            const selected = m === mode;
            return (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={[styles.modeTab, selected && styles.modeTabSelected]}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.modeText, selected && styles.modeTextSelected]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.topActions}>
          {reloading ? <ActivityIndicator size="small" color={colors.textSecondary} /> : null}
          <Pressable
            onPress={() => void reload()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="重新載入"
          >
            <Icon name="refresh" color={colors.text} size={22} />
          </Pressable>
          <Pressable
            onPress={() => setAnchor(todayIsoDate())}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={styles.todayText}>TODAY</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.navRow}>
        <Pressable
          onPress={() => step(-1)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="上一頁"
        >
          <Icon name="chevronLeft" color={colors.text} />
        </Pressable>
        <Text style={styles.navTitle}>{title}</Text>
        <Pressable
          onPress={() => step(1)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="下一頁"
        >
          <Icon name="chevronRight" color={colors.text} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => void reload()}>
            <Text style={styles.retryText}>重試</Text>
          </Pressable>
        </View>
      ) : mode === 'month' ? (
        <MonthView anchor={anchor} byDate={byDate} onPressDay={openDay} />
      ) : (
        <TimeGrid
          days={mode === 'week' ? weekDates(anchor) : [anchor]}
          byDate={byDate}
          onPressAppointment={showAppointmentDetails}
          onPressDay={openDay}
        />
      )}

      <AddButton date={mode === 'day' ? anchor : undefined} />
    </SafeAreaView>
  );
}

function groupByDateSorted(appointments: Appointment[]): Map<string, Appointment[]> {
  const map = new Map<string, Appointment[]>();
  for (const apt of appointments) {
    const list = map.get(apt.date) ?? [];
    list.push(apt);
    map.set(apt.date, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.time.localeCompare(b.time));
  return map;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  modeTabs: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modeTab: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 3,
    borderColor: 'transparent',
  },
  modeTabSelected: {
    borderColor: colors.accent,
  },
  modeText: {
    fontSize: 17,
    color: colors.textSecondary,
  },
  modeTextSelected: {
    color: colors.text,
    fontWeight: '700',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  todayText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  navTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  errorText: {
    color: colors.danger,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  retryText: {
    color: colors.onAccent,
    fontWeight: '600',
  },
});

/**
 * 時間表 tab (home) — Day / Week / Month calendar, modelled on the AppSheet
 * timetable (reference/timetable.png). Tapping a day opens it in Day view;
 * tapping an appointment opens its details (with 修改 / 刪除).
 */
import { useEffect, useMemo, useState } from 'react';
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
import { StateView } from '@/components/StateView';
import { colors, pressedStyle, radius, spacing, type } from '@/constants/theme';
import { prefetchAppointments, useAppointments } from '@/hooks/useAppointments';
import type { Appointment } from '@/types/appointment';
import { openAppointmentDetails } from '@/utils/appointmentActions';
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
  { mode: 'day', label: '日' },
  { mode: 'week', label: '週' },
  { mode: 'month', label: '月' },
];

export default function TimetableScreen() {
  const [mode, setMode] = useState<ViewMode>('month');
  const [anchor, setAnchor] = useState(todayIsoDate);

  const range = useMemo(() => timetableRange(anchor), [anchor]);

  const { appointments, loading, reloading, error, reload } = useAppointments(range);

  // Once this month is on screen, load the months either side so paging is instant
  useEffect(() => {
    if (loading) return;
    prefetchAppointments(timetableRange(addMonths(anchor, 1)));
    prefetchAppointments(timetableRange(addMonths(anchor, -1)));
  }, [anchor, loading]);

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
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
          {title}
        </Text>
        <View style={styles.topActions}>
          {reloading ? <ActivityIndicator size="small" color={colors.textSecondary} /> : null}
          <Pressable
            onPress={() => void reload()}
            hitSlop={8}
            style={({ pressed }) => [styles.iconBtn, pressed && pressedStyle]}
            accessibilityRole="button"
            accessibilityLabel="重新載入"
          >
            <Icon name="refresh" color={colors.textSecondary} size={20} />
          </Pressable>
          <Pressable
            onPress={() => setAnchor(todayIsoDate())}
            style={({ pressed }) => [styles.todayBtn, pressed && pressedStyle]}
            accessibilityRole="button"
            accessibilityLabel="回到今日"
          >
            <Text style={styles.todayText}>今日</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.navRow}>
        <View style={styles.segmented} accessibilityRole="tablist">
          {VIEW_MODES.map(({ mode: m, label }) => {
            const selected = m === mode;
            return (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={[styles.segment, selected && styles.segmentSelected]}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.stepper}>
          <Pressable
            onPress={() => step(-1)}
            hitSlop={8}
            style={({ pressed }) => [styles.iconBtn, pressed && pressedStyle]}
            accessibilityRole="button"
            accessibilityLabel="上一頁"
          >
            <Icon name="chevronLeft" color={colors.text} size={20} />
          </Pressable>
          <Pressable
            onPress={() => step(1)}
            hitSlop={8}
            style={({ pressed }) => [styles.iconBtn, pressed && pressedStyle]}
            accessibilityRole="button"
            accessibilityLabel="下一頁"
          >
            <Icon name="chevronRight" color={colors.text} size={20} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <StateView loading title="載入時間表中…" />
      ) : error ? (
        <StateView
          title="未能載入時間表"
          message={error}
          tone="error"
          action={{ label: '重試', onPress: () => void reload() }}
        />
      ) : mode === 'month' ? (
        <MonthView anchor={anchor} byDate={byDate} onPressDay={openDay} />
      ) : (
        <TimeGrid
          days={mode === 'week' ? weekDates(anchor) : [anchor]}
          byDate={byDate}
          onPressAppointment={openAppointmentDetails}
          onPressDay={openDay}
        />
      )}

      <AddButton date={mode === 'day' ? anchor : undefined} />
    </SafeAreaView>
  );
}

/**
 * Fetch the whole month grid (plus the anchor's week, which can spill into
 * the next month), so switching Day/Week/Month within a month doesn't refetch.
 */
function timetableRange(anchor: string): { from: string; to: string } {
  const grid = monthGrid(anchor);
  const week = weekDates(anchor);
  const from = week[0] < grid[0][0] ? week[0] : grid[0][0];
  const last = grid[grid.length - 1][6];
  const to = week[6] > last ? week[6] : last;
  return { from, to };
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
    paddingTop: spacing.md,
  },
  title: {
    ...type.title,
    flexShrink: 1,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  todayBtn: {
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
  },
  todayText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  segmented: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.sm + 2,
    backgroundColor: colors.surface,
  },
  segment: {
    minWidth: 52,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  segmentSelected: {
    backgroundColor: colors.surfaceRaised,
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  segmentTextSelected: {
    color: colors.text,
    fontWeight: '700',
  },
  stepper: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});

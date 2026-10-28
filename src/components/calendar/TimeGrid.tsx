import { useRef } from 'react';
import {
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, spacing } from '@/constants/theme';
import { useNow } from '@/hooks/useNow';
import { useHideTabBarOnScroll, useTabBarInset } from '@/hooks/useTabBarVisibility';
import type { Appointment } from '@/types/appointment';
import { parseIsoDate, toIsoDate, WEEKDAY_LABELS } from '@/utils/dates';

import { firstVisibleHour, layoutBlocks } from './layoutBlocks';
import { TimeGridBlock } from './TimeGridBlock';

const HOUR_HEIGHT = 56;
const LABEL_WIDTH = 44;

type Props = {
  /** One date for the Day view, seven for the Week view. */
  days: string[];
  byDate: Map<string, Appointment[]>;
  onPressAppointment: (appointment: Appointment) => void;
  /** Week view: tap a column header to open that day. */
  onPressDay?: (date: string) => void;
};

/** Day / Week time grid. Overlapping appointments share the column side by side. */
export function TimeGrid({ days, byDate, onPressAppointment, onPressDay }: Props) {
  const { scrollHandlers } = useHideTabBarOnScroll();
  const tabBarInset = useTabBarInset();
  const compact = days.length > 1;
  const now = useNow();
  const today = toIsoDate(now);
  const blocksByDay = days.map((date) => layoutBlocks(byDate.get(date) ?? []));
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const showNow = days.includes(today);
  const nowLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  // The whole day, like iOS Calendar; it opens scrolled to now or the first booking
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const gridHeight = hours.length * HOUR_HEIGHT;
  const toY = (minutes: number) => (minutes / 60) * HOUR_HEIGHT;
  const initialY = showNow
    ? toY(nowMinutes - 60)
    : toY(firstVisibleHour(blocksByDay.flat()) * 60) - HOUR_HEIGHT / 4;
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrolledFor = useRef<string | null>(null);
  const daysKey = days.join(',');

  return (
    <View style={styles.container}>
      {compact ? (
        <View style={styles.headerRow}>
          <View style={{ width: LABEL_WIDTH }} />
          {days.map((date) => {
            const isToday = date === today;
            return (
              <Pressable
                key={date}
                style={styles.headerCell}
                onPress={() => onPressDay?.(date)}
                accessibilityRole="button"
              >
                <Text style={styles.headerWeekday}>
                  {WEEKDAY_LABELS[parseIsoDate(date).getDay()]}
                </Text>
                <View style={[styles.headerBadge, isToday && styles.headerBadgeToday]}>
                  <Text style={[styles.headerDay, isToday && styles.headerDayToday]}>
                    {String(Number(date.slice(8)))}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <ScrollView
        // A new page of days remounts it, so onLayout scrolls it to its opening hour
        key={daysKey}
        ref={scrollRef}
        // Once per page, not on every reload or minute
        onLayout={() => {
          if (scrolledFor.current === daysKey) return;
          scrolledFor.current = daysKey;
          scrollRef.current?.scrollTo({ y: Math.max(initialY, 0), animated: false });
        }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: styles.scrollContent.paddingBottom + tabBarInset },
        ]}
        {...scrollHandlers}
      >
        <View style={[styles.grid, { height: gridHeight }]}>
          <View style={{ width: LABEL_WIDTH }}>
            {hours.map((hour) =>
              // The now label takes the place of an hour label it would overlap
              showNow && Math.abs(nowMinutes - hour * 60) < 15 ? null : (
                <Text key={hour} style={[styles.hourLabel, { top: toY(hour * 60) - 7 }]}>
                  {`${String(hour).padStart(2, '0')}:00`}
                </Text>
              ),
            )}
            {showNow ? (
              <View style={[styles.nowLabel, { top: toY(nowMinutes) - 8 }]} pointerEvents="none">
                <Text style={styles.nowLabelText}>{nowLabel}</Text>
              </View>
            ) : null}
          </View>

          {days.map((date, dayIndex) => (
            <View key={date} style={styles.column}>
              {hours.map((hour) => (
                <View key={hour} style={[styles.hourLine, { top: toY(hour * 60) }]} />
              ))}

              {showNow ? (
                // Week view: a faint line across the other days, solid on today
                <View
                  style={[
                    styles.nowLine,
                    date !== today && styles.nowLineOtherDay,
                    { top: toY(nowMinutes) - 1 },
                  ]}
                  pointerEvents="none"
                >
                  {date === today ? <View style={styles.nowDot} /> : null}
                </View>
              ) : null}

              {blocksByDay[dayIndex].map((block) => {
                const widthPct = 100 / block.lanes;
                return (
                  <TimeGridBlock
                    key={block.appointment.id}
                    appointment={block.appointment}
                    frame={{
                      top: toY(block.start),
                      height: Math.max(toY(block.end) - toY(block.start), 18),
                      left: `${block.lane * widthPct}%`,
                      width: `${widthPct}%`,
                    }}
                    compact={compact}
                    lanes={block.lanes}
                    onPress={onPressAppointment}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  headerCell: {
    flex: 1,
    alignItems: 'center',
  },
  headerWeekday: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  headerBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  headerBadgeToday: {
    backgroundColor: colors.accent,
  },
  headerDay: {
    color: colors.text,
    fontSize: 14,
  },
  headerDayToday: {
    color: colors.onAccent,
    fontWeight: '700',
  },
  scrollContent: {
    paddingTop: spacing.sm,
    // Leave room for the floating add button
    paddingBottom: 96,
  },
  grid: {
    flexDirection: 'row',
  },
  hourLabel: {
    position: 'absolute',
    right: spacing.xs + 2,
    fontSize: 11,
    color: colors.textTertiary,
    fontVariant: ['tabular-nums'],
  },
  column: {
    flex: 1,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  hourLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  nowLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.accent,
    zIndex: 1,
  },
  nowLineOtherDay: {
    height: 1,
    opacity: 0.4,
  },
  nowLabel: {
    position: 'absolute',
    right: 2,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    justifyContent: 'center',
    backgroundColor: colors.accent,
    zIndex: 1,
  },
  nowLabelText: {
    color: colors.onAccent,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  nowDot: {
    position: 'absolute',
    left: -4,
    top: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
});

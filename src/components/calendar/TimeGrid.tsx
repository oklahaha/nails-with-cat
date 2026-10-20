import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { serviceColor } from '@/constants/services';
import { colors, spacing } from '@/constants/theme';
import type { Appointment } from '@/types/appointment';
import { appointmentTitle } from '@/utils/appointmentTitle';
import {
  parseIsoDate,
  timeToMinutes,
  todayIsoDate,
  WEEKDAY_LABELS,
} from '@/utils/dates';

const HOUR_HEIGHT = 56;
const LABEL_WIDTH = 44;
/** Default visible hours; widened if an appointment falls outside. */
const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 21;
/** Shortest block drawn, so zero-length rows (e.g. 特別事項) stay tappable. */
const MIN_BLOCK_MINUTES = 30;

type Props = {
  /** One date for the Day view, seven for the Week view. */
  days: string[];
  byDate: Map<string, Appointment[]>;
  onPressAppointment: (appointment: Appointment) => void;
  /** Week view: tap a column header to open that day. */
  onPressDay?: (date: string) => void;
};

type Block = {
  appointment: Appointment;
  start: number;
  end: number;
  lane: number;
  lanes: number;
};

/** Day / Week time grid. Overlapping appointments share the column side by side. */
export function TimeGrid({ days, byDate, onPressAppointment, onPressDay }: Props) {
  const compact = days.length > 1;
  const today = todayIsoDate();
  const blocksByDay = days.map((date) => layoutBlocks(byDate.get(date) ?? []));
  const [startHour, endHour] = visibleHours(blocksByDay.flat());
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const gridHeight = hours.length * HOUR_HEIGHT;
  const toY = (minutes: number) => ((minutes - startHour * 60) / 60) * HOUR_HEIGHT;

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

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.grid, { height: gridHeight }]}>
          <View style={{ width: LABEL_WIDTH }}>
            {hours.map((hour) => (
              <Text key={hour} style={[styles.hourLabel, { top: toY(hour * 60) - 7 }]}>
                {`${String(hour).padStart(2, '0')}:00`}
              </Text>
            ))}
          </View>

          {days.map((date, dayIndex) => (
            <View key={date} style={styles.column}>
              {hours.map((hour) => (
                <View key={hour} style={[styles.hourLine, { top: toY(hour * 60) }]} />
              ))}

              {blocksByDay[dayIndex].map((block) => {
                const { appointment: apt } = block;
                const widthPct = 100 / block.lanes;
                return (
                  <Pressable
                    key={apt.id}
                    onPress={() => onPressAppointment(apt)}
                    style={({ pressed }) => [
                      styles.block,
                      {
                        top: toY(block.start),
                        height: Math.max(toY(block.end) - toY(block.start), 18),
                        left: `${block.lane * widthPct}%`,
                        width: `${widthPct}%`,
                        backgroundColor: serviceColor(apt.service),
                      },
                      pressed && styles.blockPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${apt.time} ${appointmentTitle(apt)} ${apt.service}`}
                  >
                    {compact ? (
                      <Text style={styles.blockTextCompact} numberOfLines={3}>
                        {appointmentTitle(apt)}
                      </Text>
                    ) : (
                      <>
                        <Text style={styles.blockTitle} numberOfLines={1}>
                          {apt.time}
                          {apt.endTime && apt.endTime !== apt.time ? `–${apt.endTime}` : ''}{' '}
                          {appointmentTitle(apt)}
                        </Text>
                        <Text style={styles.blockText} numberOfLines={1}>
                          {apt.service}
                          {apt.notes && apt.notes !== appointmentTitle(apt) ? ` · ${apt.notes}` : ''}
                        </Text>
                      </>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function blockEnd(apt: Appointment, start: number): number {
  let end = apt.endTime ? timeToMinutes(apt.endTime) : NaN;
  if (!(end > start) && apt.durationMinutes) end = start + apt.durationMinutes;
  if (!(end > start)) end = start;
  return Math.max(end, start + MIN_BLOCK_MINUTES);
}

/** Assign side-by-side lanes to overlapping appointments within one day. */
function layoutBlocks(appointments: Appointment[]): Block[] {
  const sorted = appointments
    .map((apt) => {
      const start = timeToMinutes(apt.time);
      return { appointment: apt, start, end: blockEnd(apt, start), lane: 0, lanes: 1 };
    })
    .sort((a, b) => a.start - b.start);

  const result: Block[] = [];
  let cluster: Block[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const closeCluster = () => {
    for (const block of cluster) block.lanes = laneEnds.length;
    result.push(...cluster);
    cluster = [];
    laneEnds = [];
  };

  for (const block of sorted) {
    if (block.start >= clusterEnd) closeCluster();
    let lane = laneEnds.findIndex((end) => end <= block.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = block.end;
    block.lane = lane;
    cluster.push(block);
    clusterEnd = Math.max(clusterEnd, block.end);
  }
  closeCluster();

  return result;
}

function visibleHours(blocks: Block[]): [number, number] {
  let start = DEFAULT_START_HOUR;
  let end = DEFAULT_END_HOUR;
  for (const block of blocks) {
    start = Math.min(start, Math.floor(block.start / 60));
    end = Math.max(end, Math.ceil(block.end / 60));
  }
  return [start, Math.min(end, 24)];
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
    right: spacing.xs,
    fontSize: 11,
    color: colors.textSecondary,
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
  block: {
    position: 'absolute',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.background,
  },
  blockPressed: {
    opacity: 0.8,
  },
  blockTitle: {
    color: colors.onAccent,
    fontSize: 13,
    fontWeight: '700',
  },
  blockText: {
    color: colors.onAccent,
    fontSize: 12,
  },
  blockTextCompact: {
    color: colors.onAccent,
    fontSize: 10,
    fontWeight: '600',
  },
});

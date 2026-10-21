import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, type } from '@/constants/theme';
import type { Appointment } from '@/types/appointment';
import { appointmentTitle } from '@/utils/appointmentTitle';
import { minutesToTime, timeToMinutes } from '@/utils/dates';

const FIRST_SLOT = 9 * 60;
const LAST_SLOT = 20 * 60 + 30;
const SLOT_STEP = 30;

const NO_BOOKINGS: Appointment[] = [];

const SLOTS = Array.from(
  { length: (LAST_SLOT - FIRST_SLOT) / SLOT_STEP + 1 },
  (_, i) => minutesToTime(FIRST_SLOT + i * SLOT_STEP)
);

type Props = {
  /** HH:mm, or '' when nothing is picked yet. */
  value: string;
  onChange: (time: string) => void;
  /** Length of the booking being made, to find clashes. */
  durationMinutes?: number;
  /** Other bookings that day. Omit to hide clash marks (e.g. when picking an end time). */
  bookings?: Appointment[];
  loadingBookings?: boolean;
  /** HH:mm; earlier slots are left out (e.g. an end time before the start). */
  minTime?: string;
  invalid?: boolean;
};

/**
 * Half-hour slots for the day. Slots that would overlap an existing booking are
 * marked (but still selectable, since overlaps are sometimes intended).
 * "其他時間" allows any HH:mm.
 */
export function TimeSlotPicker({
  value,
  onChange,
  durationMinutes,
  bookings = NO_BOOKINGS,
  loadingBookings,
  minTime,
  invalid,
}: Props) {
  const showLegend = bookings !== NO_BOOKINGS;
  const [custom, setCustom] = useState(() => value !== '' && !SLOTS.includes(value));
  const length = Math.max(durationMinutes ?? 0, SLOT_STEP);
  const spans = bookings.map(bookingSpan);

  const clashesWith = (time: string) => {
    const start = timeToMinutes(time);
    const end = start + length;
    return bookings.filter((_, i) => start < spans[i][1] && spans[i][0] < end);
  };

  const selectedClash = /^\d{2}:\d{2}$/.test(value) ? clashesWith(value) : [];
  const slots = minTime ? SLOTS.filter((slot) => slot >= minTime) : SLOTS;

  return (
    <View>
      {showLegend ? (
        <View style={styles.legendRow}>
          {loadingBookings ? (
            <>
              <ActivityIndicator size="small" color={colors.textTertiary} />
              <Text style={styles.legendText}>正在查看當日預約…</Text>
            </>
          ) : bookings.length > 0 ? (
            <>
              <View style={styles.busyDot} />
              <Text style={styles.legendText}>當日已有 {bookings.length} 個預約，有點的時段會撞期</Text>
            </>
          ) : (
            <Text style={styles.legendText}>當日未有其他預約</Text>
          )}
        </View>
      ) : null}

      <View style={[styles.grid, invalid && !value && styles.gridInvalid]}>
        {slots.map((slot) => {
          const selected = !custom && value === slot;
          const busy = clashesWith(slot).length > 0;
          return (
            <Pressable
              key={slot}
              onPress={() => {
                setCustom(false);
                onChange(slot);
              }}
              style={[styles.slot, busy && styles.slotBusy, selected && styles.slotSelected]}
              accessibilityRole="button"
              accessibilityLabel={busy ? `${slot}，已有預約` : slot}
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.slotText,
                  busy && styles.slotTextBusy,
                  selected && styles.slotTextSelected,
                ]}
              >
                {slot}
              </Text>
              {busy && !selected ? <View style={styles.slotDot} /> : null}
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => {
            setCustom(true);
            if (SLOTS.includes(value)) onChange('');
          }}
          style={[styles.slot, styles.slotWide, custom && styles.slotSelected]}
          accessibilityRole="button"
          accessibilityState={{ selected: custom }}
        >
          <Text style={[styles.slotText, custom && styles.slotTextSelected]}>其他時間</Text>
        </Pressable>
      </View>

      {custom ? (
        <TextInput
          style={[styles.customInput, invalid && styles.customInvalid]}
          value={value}
          onChangeText={onChange}
          placeholder="HH:mm，例如 14:15"
          placeholderTextColor={colors.textTertiary}
          keyboardType="numbers-and-punctuation"
          autoCorrect={false}
          autoFocus
          maxLength={5}
        />
      ) : null}

      {selectedClash.length > 0 ? (
        <Text style={styles.warning}>
          會與 {selectedClash.map((b) => `${b.time} ${appointmentTitle(b)}`).join('、')} 撞期
        </Text>
      ) : null}
    </View>
  );
}

/** Start/end minutes of a booking; zero-length rows block their half hour. */
function bookingSpan(apt: Appointment): [number, number] {
  const start = timeToMinutes(apt.time);
  let end = apt.endTime ? timeToMinutes(apt.endTime) : NaN;
  if (!(end > start) && apt.durationMinutes) end = start + apt.durationMinutes;
  if (!(end > start)) end = start + SLOT_STEP;
  return [start, end];
}

const styles = StyleSheet.create({
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  legendText: {
    ...type.caption,
    fontSize: 12,
  },
  busyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.danger,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    borderRadius: radius.sm,
  },
  gridInvalid: {
    padding: 4,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  slot: {
    // Four per row on a phone
    width: '22.5%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  slotWide: {
    width: '47%',
  },
  slotBusy: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  slotSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  slotText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  slotTextBusy: {
    color: colors.textSecondary,
  },
  slotTextSelected: {
    color: colors.onAccent,
    fontWeight: '700',
  },
  slotDot: {
    position: 'absolute',
    top: 5,
    right: 6,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.danger,
  },
  customInput: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: 16,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  customInvalid: {
    borderColor: colors.danger,
  },
  warning: {
    marginTop: spacing.sm,
    color: colors.danger,
    fontSize: 13,
  },
});

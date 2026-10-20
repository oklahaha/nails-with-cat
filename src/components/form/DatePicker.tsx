import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { colors, pressedStyle, radius, spacing } from '@/constants/theme';
import {
  addDays,
  addMonths,
  formatMonthTitle,
  isSameMonth,
  monthGrid,
  todayIsoDate,
  WEEKDAY_LABELS,
} from '@/utils/dates';
import { formatDateHeader } from '@/utils/groupByDate';

type Props = {
  /** YYYY-MM-DD, or '' when nothing is picked yet. */
  value: string;
  onChange: (date: string) => void;
  invalid?: boolean;
};

/** Quick 今日 / 明日 / 後日 chips, plus an inline month calendar for other dates. */
export function DatePicker({ value, onChange, invalid }: Props) {
  const today = todayIsoDate();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(value || today);

  const quick = [
    { label: '今日', date: today },
    { label: '明日', date: addDays(today, 1) },
    { label: '後日', date: addDays(today, 2) },
  ];

  const pick = (date: string) => {
    onChange(date);
    setOpen(false);
  };

  return (
    <View>
      <View style={styles.quickRow}>
        {quick.map(({ label, date }) => {
          const selected = value === date;
          return (
            <Pressable
              key={label}
              onPress={() => pick(date)}
              style={({ pressed }) => [
                styles.quickChip,
                selected && styles.chipSelected,
                pressed && pressedStyle,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.quickText, selected && styles.chipTextSelected]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => {
          setMonth(value || today);
          setOpen((o) => !o);
        }}
        style={({ pressed }) => [
          styles.field,
          invalid && styles.fieldInvalid,
          pressed && styles.fieldPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={value ? `日期：${formatDateHeader(value)}，更改日期` : '選擇日期'}
      >
        <Icon name="calendar" color={value ? colors.accent : colors.textTertiary} size={18} />
        <Text style={[styles.fieldText, !value && styles.placeholder]}>
          {value ? formatDateHeader(value) : '選擇其他日期'}
        </Text>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} color={colors.textTertiary} size={18} />
      </Pressable>

      {open ? (
        <View style={styles.calendar}>
          <View style={styles.calHeader}>
            <Pressable
              onPress={() => setMonth(addMonths(month, -1))}
              hitSlop={8}
              style={styles.calNav}
              accessibilityRole="button"
              accessibilityLabel="上個月"
            >
              <Icon name="chevronLeft" color={colors.text} size={18} />
            </Pressable>
            <Text style={styles.calTitle}>{formatMonthTitle(month)}</Text>
            <Pressable
              onPress={() => setMonth(addMonths(month, 1))}
              hitSlop={8}
              style={styles.calNav}
              accessibilityRole="button"
              accessibilityLabel="下個月"
            >
              <Icon name="chevronRight" color={colors.text} size={18} />
            </Pressable>
          </View>

          <View style={styles.calRow}>
            {WEEKDAY_LABELS.map((label) => (
              <Text key={label} style={styles.calWeekday}>
                {label}
              </Text>
            ))}
          </View>

          {monthGrid(month).map((week) => (
            <View key={week[0]} style={styles.calRow}>
              {week.map((date) => {
                const inMonth = isSameMonth(date, month);
                const selected = date === value;
                const isToday = date === today;
                return (
                  <Pressable
                    key={date}
                    onPress={() => pick(date)}
                    style={styles.calCell}
                    accessibilityRole="button"
                    accessibilityLabel={formatDateHeader(date)}
                    accessibilityState={{ selected }}
                  >
                    <View
                      style={[
                        styles.calDay,
                        isToday && styles.calDayToday,
                        selected && styles.calDaySelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.calDayText,
                          !inMonth && styles.calDayOutside,
                          selected && styles.calDayTextSelected,
                        ]}
                      >
                        {String(Number(date.slice(8)))}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  quickChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  quickText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: colors.accent,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  fieldInvalid: {
    borderColor: colors.danger,
  },
  fieldPressed: {
    backgroundColor: colors.surfaceRaised,
  },
  fieldText: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
  },
  placeholder: {
    color: colors.textTertiary,
  },
  calendar: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  calNav: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  calRow: {
    flexDirection: 'row',
  },
  calWeekday: {
    flex: 1,
    textAlign: 'center',
    color: colors.textTertiary,
    fontSize: 12,
    paddingVertical: spacing.xs,
  },
  calCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  calDay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDayToday: {
    borderWidth: 1,
    borderColor: colors.accent,
  },
  calDaySelected: {
    backgroundColor: colors.accent,
  },
  calDayText: {
    color: colors.text,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  calDayOutside: {
    color: colors.textTertiary,
  },
  calDayTextSelected: {
    color: colors.onAccent,
    fontWeight: '700',
  },
});

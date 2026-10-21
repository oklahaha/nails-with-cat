import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { serviceColor } from '@/constants/services';
import { colors, pressedStyle, radius, spacing, type } from '@/constants/theme';
import type { Appointment } from '@/types/appointment';
import { openAppointmentDetails } from '@/utils/appointmentActions';
import { formatShortDate, todayIsoDate } from '@/utils/dates';

/** Past visits shown before 顯示全部; long-time customers have years of rows. */
const PAST_PREVIEW = 10;

type Props = {
  /** Newest first */
  appointments: Appointment[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

/**
 * A customer's booking history for 顧客資料: visit count, last and next
 * visit, then upcoming and past bookings. Rows open the appointment details.
 */
export function CustomerHistory({ appointments, loading, error, onRetry }: Props) {
  const [showAll, setShowAll] = useState(false);

  const today = todayIsoDate();
  // Today's booking counts as upcoming until it's marked 已完成
  const isUpcoming = (apt: Appointment) =>
    apt.date > today || (apt.date === today && apt.status !== '已完成');
  const upcoming = appointments.filter(isUpcoming).reverse();
  const past = appointments.filter((apt) => !isUpcoming(apt));
  const shownPast = showAll ? past : past.slice(0, PAST_PREVIEW);

  return (
    <View style={styles.section}>
      <Text style={styles.label}>預約記錄</Text>

      {loading ? (
        <View style={styles.status}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      ) : error && appointments.length === 0 ? (
        <View style={styles.status}>
          <Text style={styles.statusText}>未能載入預約記錄：{error}</Text>
          <Pressable onPress={onRetry} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.link}>重試</Text>
          </Pressable>
        </View>
      ) : appointments.length === 0 ? (
        <View style={styles.status}>
          <Text style={styles.statusText}>暫時未有預約記錄</Text>
        </View>
      ) : (
        <>
          <View style={styles.stats}>
            <Stat label="來店次數" value={`${past.length} 次`} />
            <DateStat label="最近來店" date={past[0]?.date} />
            <DateStat label="下次預約" date={upcoming[0]?.date} />
          </View>

          {upcoming.length > 0 ? (
            <>
              <Text style={styles.groupLabel}>即將預約</Text>
              <View style={styles.list}>
                {upcoming.map((apt, i) => (
                  <HistoryRow key={apt.id} appointment={apt} divider={i > 0} />
                ))}
              </View>
            </>
          ) : null}

          {past.length > 0 ? (
            <>
              <Text style={styles.groupLabel}>過往記錄</Text>
              <View style={styles.list}>
                {shownPast.map((apt, i) => (
                  <HistoryRow key={apt.id} appointment={apt} divider={i > 0} />
                ))}
              </View>
              {past.length > shownPast.length ? (
                <Pressable
                  onPress={() => setShowAll(true)}
                  style={({ pressed }) => [styles.more, pressed && pressedStyle]}
                  accessibilityRole="button"
                >
                  <Text style={styles.link}>顯示全部 {past.length} 項</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </View>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

/** Month and day, with the year underneath, so it fits a third of the row. */
function DateStat({ label, date }: { label: string; date?: string }) {
  const [y, m, d] = (date ?? '').split('-').map(Number);
  if (!y || !m || !d) return <Stat label={label} value="—" />;
  return <Stat label={label} value={`${m}月${d}日`} sub={`${y}年`} />;
}

function HistoryRow({ appointment, divider }: { appointment: Appointment; divider: boolean }) {
  // 手/腳 only matters for nail services, and $0 is the sheet's "no charge" filler
  const meta = [
    appointment.service,
    appointment.service.includes('甲') ? appointment.handOrFoot : null,
    appointment.price ? `$${appointment.price}` : null,
  ].filter(Boolean);

  return (
    <Pressable
      onPress={() => openAppointmentDetails(appointment)}
      style={({ pressed }) => [
        styles.row,
        divider && styles.rowDivider,
        pressed && styles.rowPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${appointment.date} ${appointment.time} ${appointment.service}`}
    >
      <View style={[styles.stripe, { backgroundColor: serviceColor(appointment.service) }]} />
      <View style={styles.rowBody}>
        <Text style={styles.rowDate}>
          {formatShortDate(appointment.date)}
          {appointment.time ? <Text style={styles.rowTime}>  {appointment.time}</Text> : null}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {meta.join(' · ')}
        </Text>
        {appointment.notes ? (
          <Text style={styles.rowNotes} numberOfLines={2}>
            {appointment.notes}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.lg,
  },
  label: {
    ...type.label,
    marginBottom: spacing.sm,
  },
  status: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  statusText: {
    ...type.caption,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  link: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm + 6,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  statLabel: {
    ...type.caption,
  },
  statValue: {
    ...type.body,
    ...type.time,
    fontWeight: '600',
    textAlign: 'center',
  },
  statSub: {
    ...type.caption,
    fontSize: 12,
  },
  groupLabel: {
    ...type.caption,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  list: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowPressed: {
    backgroundColor: colors.surfaceRaised,
  },
  stripe: {
    width: 3,
    borderRadius: 2,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowDate: {
    ...type.body,
    ...type.time,
    fontWeight: '600',
  },
  rowTime: {
    color: colors.textSecondary,
    fontWeight: '400',
  },
  rowMeta: {
    ...type.caption,
  },
  rowNotes: {
    ...type.caption,
    color: colors.textTertiary,
  },
  more: {
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
  },
});

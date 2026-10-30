/**
 * Appointment details — opened by tapping a booking in the timetable or the
 * 預約資料 list. Shows the booking's fields in the same order and with the
 * same labels as the add-appointment form, with 修改 (opens the form in edit
 * mode) and 刪除. Bookings with a paid 訂金 have 保留訂金, which marks the
 * deposit as kept for the customer's next booking.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { StateView } from '@/components/StateView';
import {
  serviceColor,
  usesDeposit,
  usesHandOrFoot,
  showsNailExtras,
  toComplexDesign,
  NAIL_EXTRAS,
} from '@/constants/services';
import { colors, pressedStyle, radius, spacing, tint, type } from '@/constants/theme';
import { removeAppointment } from '@/hooks/appointmentWrites';
import { findCachedAppointment } from '@/hooks/useAppointments';
import { useKeptDepositHint } from '@/hooks/useKeptDepositHint';
import { showAlert } from '@/utils/alert';
import {
  askKeepDeposit,
  canKeepDeposit,
  hasCustomerActions,
  openAppointmentCustomer,
} from '@/utils/appointmentActions';
import { appointmentTitle } from '@/utils/appointmentTitle';
import { formatDuration } from '@/utils/dates';
import { formatDateHeader } from '@/utils/groupByDate';
import { formatPhone } from '@/utils/phone';

function close() {
  // On web the page may be opened directly, with no history to go back to
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function AppointmentDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  // Snapshot at open, so a background reload doesn't change it under the user
  const [appointment, setAppointment] = useState(() =>
    id ? findCachedAppointment(id) : undefined
  );
  const keptDepositHint = useKeptDepositHint(appointment);

  // e.g. the web page was reloaded, so the appointment list isn't loaded
  if (!appointment) {
    return (
      <StateView
        icon="calendar"
        title="找不到此預約"
        message="請返回時間表，再揀選預約。"
        action={{ label: '返回', onPress: close }}
      />
    );
  }

  const color = serviceColor(appointment.service);
  const isSpecial = appointment.service === '特別事項';
  const phone = appointment.phone?.trim();
  const hasEnd = Boolean(appointment.endTime && appointment.endTime !== appointment.time);
  const timeRange = `${appointment.time}${hasEnd ? ` – ${appointment.endTime}` : ''}${
    appointment.durationMinutes ? `（${formatDuration(appointment.durationMinutes)}）` : ''
  }`;
  const showNailExtras = showsNailExtras(appointment.service, appointment.handOrFoot ?? '');
  const extras = NAIL_EXTRAS.filter(({ key }) => appointment[key]).map(({ label }) => label);
  // The form's sections, in its order but with 狀態 last; rows the form hides
  // for this service are left out
  // onPress: the 顧客 row opens 顧客資料
  const rows: { label: string; value?: string; onPress?: () => void }[] = isSpecial
    ? [
        { label: '備注', value: appointment.notes },
        { label: '日期', value: formatDateHeader(appointment.date) },
        { label: '開始時間', value: appointment.time },
        { label: '完結時間', value: hasEnd ? appointment.endTime : undefined },
      ]
    : [
        {
          label: '顧客',
          value: appointment.customerName,
          onPress: hasCustomerActions(appointment)
            ? () => openAppointmentCustomer(appointment)
            : undefined,
        },
        ...(phone ? [{ label: '電話', value: formatPhone(phone) }] : []),
        { label: '日期', value: formatDateHeader(appointment.date) },
        { label: '開始時間', value: timeRange },
        ...(usesHandOrFoot(appointment.service)
          ? [{ label: '手/腳', value: appointment.handOrFoot }]
          : []),
        ...(showNailExtras
          ? [
              { label: '複雜款', value: toComplexDesign(appointment.complexDesign) },
              { label: '附加', value: extras.join('、') || '沒有' },
            ]
          : []),
        ...(usesDeposit(appointment.service)
          ? [{ label: '訂金', value: appointment.deposit ? '已付' : '未付' }]
          : []),
        ...(appointment.keepDeposit ? [{ label: '保留訂金', value: '是（下次預約用）' }] : []),
        { label: '收費', value: appointment.price != null ? `$${appointment.price}` : undefined },
        { label: '備注', value: appointment.notes },
        { label: '狀態', value: appointment.status },
      ];

  const handleDelete = () => {
    // Disappears at once and is sent in the background; a failure brings it back
    removeAppointment(appointment);
    close();
  };

  const confirmDelete = () => {
    showAlert(
      '刪除預約？',
      `${appointmentTitle(appointment)} ${formatDateHeader(appointment.date)} ${appointment.time}\n刪除後無法復原。`,
      [
        { text: '取消', style: 'cancel' },
        { text: '刪除', style: 'destructive', onPress: () => void handleDelete() },
      ]
    );
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.title}>{appointmentTitle(appointment)}</Text>
          <View style={[styles.serviceChip, { backgroundColor: tint(color, 0.28) }]}>
            <View style={[styles.serviceDot, { backgroundColor: color }]} />
            <Text style={styles.serviceText}>{appointment.service}</Text>
          </View>
          {keptDepositHint ? <Text style={styles.keptHint}>{keptDepositHint}</Text> : null}
        </View>

        <View style={styles.card}>
          {rows.map((row, i) =>
            row.onPress ? (
              <Pressable
                key={row.label}
                onPress={row.onPress}
                style={({ pressed }) => [styles.row, i > 0 && styles.rowDivider, pressed && pressedStyle]}
                accessibilityRole="button"
                accessibilityLabel={`查看 ${row.value} 的顧客資料`}
              >
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={[styles.rowValue, styles.rowLink]}>{row.value}</Text>
                <Icon name="chevronRight" color={colors.textSecondary} size={18} />
              </Pressable>
            ) : (
              <View key={row.label} style={[styles.row, i > 0 && styles.rowDivider]}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowValue}>{row.value || '—'}</Text>
              </View>
            )
          )}
        </View>

        {canKeepDeposit(appointment) ? (
          <Pressable
            onPress={() => askKeepDeposit(appointment, setAppointment)}
            style={({ pressed }) => [styles.keepDepositBtn, pressed && pressedStyle]}
            accessibilityRole="button"
          >
            <Text style={styles.keepDepositText}>
              {appointment.keepDeposit ? '取消保留訂金' : '保留訂金'}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Pressable
          onPress={confirmDelete}
          style={({ pressed }) => [styles.deleteBtn, pressed && pressedStyle]}
          accessibilityRole="button"
        >
          <Icon name="trash" color={colors.danger} size={18} />
          <Text style={styles.deleteText}>刪除</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            // Replace, so saving the form returns straight to the calendar
            router.replace({ pathname: '/add-appointment', params: { id: appointment.id } })
          }
          style={({ pressed }) => [styles.editBtn, pressed && pressedStyle]}
          accessibilityRole="button"
        >
          <Icon name="edit" color={colors.onAccent} size={18} />
          <Text style={styles.editText}>修改</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  hero: {
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  title: {
    ...type.title,
  },
  serviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md - 4,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  keptHint: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  serviceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  serviceText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm + 6,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowLabel: {
    ...type.label,
    width: 64,
    lineHeight: 21,
  },
  rowValue: {
    ...type.body,
    ...type.time,
    flex: 1,
    lineHeight: 21,
  },
  rowLink: {
    color: colors.accent,
  },
  keepDepositBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.md - 4,
    borderRadius: radius.pill,
    backgroundColor: colors.accentMuted,
  },
  keepDepositText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md - 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  deleteText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '700',
  },
  editBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md - 2,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  editText: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '700',
  },
});

/**
 * Appointment details — opened by tapping a booking in the timetable or the
 * 預約資料 list. Shows the booking, with WhatsApp (when there's a phone),
 * 修改 (opens the form in edit mode) and 刪除.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { StateView } from '@/components/StateView';
import { serviceColor } from '@/constants/services';
import { colors, pressedStyle, radius, spacing, tint, type } from '@/constants/theme';
import { findCachedAppointment, removeCachedAppointment } from '@/hooks/useAppointments';
import { deleteAppointment, isUsingMockApi } from '@/services/appointmentsApi';
import { showAlert } from '@/utils/alert';
import { appointmentTitle } from '@/utils/appointmentTitle';
import { formatDateHeader } from '@/utils/groupByDate';
import { openWhatsApp, reminderMessage } from '@/utils/whatsapp';

function close() {
  // On web the page may be opened directly, with no history to go back to
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function AppointmentDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  // Snapshot at open, so a background reload doesn't change it under the user
  const [appointment] = useState(() => (id ? findCachedAppointment(id) : undefined));
  const [deleting, setDeleting] = useState(false);

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
  const phone = appointment.phone?.trim();
  const hasEnd = Boolean(appointment.endTime && appointment.endTime !== appointment.time);
  const rows = [
    { label: '日期', value: formatDateHeader(appointment.date) },
    {
      label: '時間',
      value: `${appointment.time}${hasEnd ? ` – ${appointment.endTime}` : ''}${
        appointment.durationMinutes ? `（${appointment.durationMinutes} 分鐘）` : ''
      }`,
    },
    { label: '手/腳', value: appointment.handOrFoot },
    { label: '收費', value: appointment.price != null ? `$${appointment.price}` : '' },
    { label: '狀態', value: appointment.status },
    { label: '電話', value: phone },
    { label: '備注', value: appointment.notes },
  ].filter((row) => row.value);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await deleteAppointment(appointment.id);
      removeCachedAppointment(appointment.id);
      if (isUsingMockApi) {
        showAlert('已刪除（模擬）', '目前使用 mock API，連上 Google Sheet 後會真正刪除。');
      }
      close();
    } catch (e) {
      showAlert('刪除失敗', e instanceof Error ? e.message : '未知錯誤');
      setDeleting(false);
    }
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
        </View>

        <View style={styles.card}>
          {rows.map((row, i) => (
            <View key={row.label} style={[styles.row, i > 0 && styles.rowDivider]}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        {phone ? (
          <Pressable
            onPress={() => void openWhatsApp(phone, reminderMessage(appointment))}
            style={({ pressed }) => [styles.whatsappBtn, pressed && pressedStyle]}
            accessibilityRole="button"
          >
            <Icon name="chat" color="#FFFFFF" size={18} />
            <Text style={styles.whatsappText}>WhatsApp 聯絡</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Pressable
          onPress={confirmDelete}
          disabled={deleting}
          style={({ pressed }) => [styles.deleteBtn, (pressed || deleting) && pressedStyle]}
          accessibilityRole="button"
        >
          {deleting ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <>
              <Icon name="trash" color={colors.danger} size={18} />
              <Text style={styles.deleteText}>刪除</Text>
            </>
          )}
        </Pressable>
        <Pressable
          onPress={() =>
            // Replace, so saving the form returns straight to the calendar
            router.replace({ pathname: '/add-appointment', params: { id: appointment.id } })
          }
          disabled={deleting}
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
    width: 48,
    lineHeight: 21,
  },
  rowValue: {
    ...type.body,
    ...type.time,
    flex: 1,
    lineHeight: 21,
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.md - 4,
    borderRadius: radius.pill,
    backgroundColor: colors.whatsapp,
  },
  whatsappText: {
    color: '#FFFFFF',
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

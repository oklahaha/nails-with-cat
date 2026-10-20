import { Pressable, StyleSheet, Text, View } from 'react-native';

import { serviceColor } from '@/constants/services';
import { colors, radius, spacing } from '@/constants/theme';
import type { Appointment } from '@/types/appointment';
import { appointmentTitle } from '@/utils/appointmentTitle';
import { openWhatsApp, reminderMessage } from '@/utils/whatsapp';

type Props = {
  appointment: Appointment;
};

/**
 * Single appointment row.
 * WhatsApp button only renders when phone is present (from 顧客 sheet).
 */
export function AppointmentCard({ appointment }: Props) {
  const hasPhone = Boolean(appointment.phone?.trim());
  const color = serviceColor(appointment.service);
  const title = appointmentTitle(appointment);

  const handleWhatsApp = () => {
    if (!appointment.phone) return;
    void openWhatsApp(appointment.phone, reminderMessage(appointment));
  };

  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <View style={styles.row}>
        <Text style={styles.time}>{appointment.time}</Text>
        {appointment.endTime ? (
          <Text style={styles.endTime}>– {appointment.endTime}</Text>
        ) : null}
        <View style={[styles.badge, { backgroundColor: color }]}>
          <Text style={styles.badgeText}>{appointment.service}</Text>
        </View>
      </View>

      <Text style={styles.name}>{title}</Text>

      {appointment.notes && appointment.notes !== title ? (
        <Text style={styles.notes} numberOfLines={2}>
          {appointment.notes}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.status}>{appointment.status}</Text>

        {hasPhone ? (
          <Pressable
            onPress={handleWhatsApp}
            style={({ pressed }) => [
              styles.whatsappBtn,
              pressed && styles.whatsappBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`用 WhatsApp 聯絡 ${appointment.customerName}`}
          >
            <Text style={styles.whatsappText}>WhatsApp</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  time: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  endTime: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  badge: {
    marginLeft: 'auto',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onAccent,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  notes: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  status: {
    fontSize: 13,
    color: colors.success,
    fontWeight: '500',
  },
  whatsappBtn: {
    backgroundColor: colors.whatsapp,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  whatsappBtnPressed: {
    opacity: 0.85,
  },
  whatsappText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});

import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { WhatsAppIcon } from '@/components/WhatsAppIcon';
import { serviceColor } from '@/constants/services';
import { colors, pressedStyle, radius, spacing, type } from '@/constants/theme';
import { NO_SHOW, type Appointment } from '@/types/appointment';
import {
  hasCustomerActions,
  openAppointmentDetails,
  showAppointmentActions,
} from '@/utils/appointmentActions';
import { appointmentTitle } from '@/utils/appointmentTitle';
import { openWhatsApp, reminderMessage } from '@/utils/whatsapp';

type Props = {
  appointment: Appointment;
};

/**
 * Single appointment row: time on the left, customer and service on the right.
 * Tapping opens the details, and a long press (Android) offers 顧客資料 and
 * No show; the WhatsApp button only renders when there's a phone (from the
 * 顧客 sheet).
 */
export function AppointmentCard({ appointment }: Props) {
  const phone = appointment.phone?.trim();
  const color = serviceColor(appointment.service);
  const title = appointmentTitle(appointment);
  const hasEnd = Boolean(appointment.endTime && appointment.endTime !== appointment.time);
  // 手/腳 only matters for nail services, and $0 is the sheet's "no charge" filler
  const meta = [
    appointment.service.includes('甲') ? appointment.handOrFoot : null,
    appointment.price ? `$${appointment.price}` : null,
    appointment.status === '已完成' || appointment.status === NO_SHOW ? appointment.status : null,
  ].filter(Boolean);

  // The WhatsApp button sits beside the tappable area, not inside it, since
  // buttons can't nest on web
  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => openAppointmentDetails(appointment)}
        onLongPress={
          Platform.OS !== 'web' && hasCustomerActions(appointment)
            ? () => showAppointmentActions(appointment)
            : undefined
        }
        style={({ pressed }) => [styles.main, pressed && styles.mainPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${appointment.time} ${title} ${appointment.service}`}
      >
        <View style={styles.timeCol}>
          <Text style={styles.time}>{appointment.time}</Text>
          {hasEnd ? <Text style={styles.endTime}>{appointment.endTime}</Text> : null}
        </View>

        <View style={[styles.stripe, { backgroundColor: color }]} />

        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.serviceRow}>
            <Text style={styles.service}>{appointment.service}</Text>
            {meta.length > 0 ? <Text style={styles.meta}>· {meta.join(' · ')}</Text> : null}
          </View>
          {appointment.notes && appointment.notes !== title ? (
            <Text style={styles.notes} numberOfLines={2}>
              {appointment.notes}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {phone ? (
        <Pressable
          onPress={() => void openWhatsApp(phone, reminderMessage(appointment))}
          hitSlop={6}
          style={({ pressed }) => [styles.whatsappBtn, pressed && pressedStyle]}
          accessibilityRole="button"
          accessibilityLabel={`用 WhatsApp 聯絡 ${appointment.customerName}`}
        >
          <WhatsAppIcon size={20} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingRight: spacing.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
    paddingVertical: spacing.md - 2,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
  },
  mainPressed: {
    backgroundColor: colors.surfaceRaised,
  },
  timeCol: {
    width: 48,
    alignSelf: 'flex-start',
  },
  time: {
    ...type.time,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  endTime: {
    ...type.time,
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 2,
  },
  stripe: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
  },
  body: {
    flex: 1,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  serviceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 3,
  },
  service: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  meta: {
    ...type.caption,
    fontSize: 14,
  },
  notes: {
    ...type.caption,
    marginTop: 6,
    lineHeight: 18,
  },
  whatsappBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.whatsapp,
  },
});

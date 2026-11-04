import { Platform, Pressable, StyleSheet, Text } from 'react-native';

import { serviceColor } from '@/constants/services';
import { colors, radius, tint, type } from '@/constants/theme';
import { NO_SHOW, type Appointment } from '@/types/appointment';
import { hasCustomerActions, showAppointmentActions } from '@/utils/appointmentActions';
import { appointmentTitle } from '@/utils/appointmentTitle';

export type TimeGridBlockProps = {
  appointment: Appointment;
  /** Position in the day column: top / height in points, left / width in %. */
  frame: { top: number; height: number; left: `${number}%`; width: `${number}%` };
  /** Week view: one short line of text. */
  compact: boolean;
  /** Side-by-side lanes in its overlap group. */
  lanes: number;
  onPress: (appointment: Appointment) => void;
};

/**
 * One appointment in the Day / Week grid. A long press offers 顧客資料 and No
 * show (Android only). iOS draws the calendar in src/components/swiftui/calendar.
 */
export function TimeGridBlock({ appointment: apt, frame, compact, lanes, onPress }: TimeGridBlockProps) {
  const color = serviceColor(apt.service);
  // Too short for two lines (e.g. 30 min): name and time on one
  const short = frame.height < 44;
  const noShow = apt.status === NO_SHOW;
  return (
    <Pressable
      onPress={() => onPress(apt)}
      onLongPress={
        Platform.OS !== 'web' && hasCustomerActions(apt) ? () => showAppointmentActions(apt) : undefined
      }
      style={({ pressed }) => [
        styles.block,
        frame,
        { backgroundColor: tint(color, 0.3), borderLeftColor: color },
        // No show bookings stay in place, faded
        noShow && styles.blockNoShow,
        pressed && styles.blockPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${apt.time} ${appointmentTitle(apt)} ${apt.service}${noShow ? ' No show' : ''}`}
    >
      {compact ? (
        // Narrow lanes get one truncated line rather than wrapping per letter
        <Text style={styles.blockTextCompact} numberOfLines={lanes > 1 ? 1 : 3}>
          {appointmentTitle(apt)}
        </Text>
      ) : short ? (
        <Text style={styles.blockTitle} numberOfLines={1}>
          {appointmentTitle(apt)}
          <Text style={styles.blockText}>
            {'  '}
            <Text style={type.time}>{apt.time}</Text> · {apt.service}
          </Text>
        </Text>
      ) : (
        <>
          <Text style={styles.blockTitle} numberOfLines={1}>
            {appointmentTitle(apt)}
          </Text>
          <Text style={styles.blockText} numberOfLines={1}>
            <Text style={type.time}>
              {apt.time}
              {apt.endTime && apt.endTime !== apt.time ? `–${apt.endTime}` : ''}
            </Text>
            {' · '}
            {apt.service}
            {apt.notes && apt.notes !== appointmentTitle(apt) ? ` · ${apt.notes}` : ''}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    position: 'absolute',
    borderRadius: radius.xs,
    borderLeftWidth: 3,
    paddingHorizontal: 5,
    paddingVertical: 3,
    overflow: 'hidden',
    // Gap between neighbouring blocks
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderRightColor: colors.background,
    borderBottomColor: colors.background,
  },
  blockNoShow: {
    opacity: 0.45,
  },
  blockPressed: {
    opacity: 0.75,
  },
  blockTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  blockText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  blockTextCompact: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '600',
  },
});

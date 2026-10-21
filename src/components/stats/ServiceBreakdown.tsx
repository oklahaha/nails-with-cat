import { StyleSheet, Text, View } from 'react-native';

import { serviceColor } from '@/constants/services';
import { colors, radius, spacing, type } from '@/constants/theme';
import { formatMoney, type ServiceStats } from '@/utils/stats';

/**
 * Bookings per service as labelled horizontal bars. The bar carries the
 * service colour (as in the calendar); names and numbers stay in text colours.
 */
export function ServiceBreakdown({ services }: { services: ServiceStats[] }) {
  const max = Math.max(...services.map((s) => s.bookings), 1);
  return (
    <View style={styles.list}>
      {services.map((s) => (
        <View key={s.service} style={styles.row}>
          <View style={styles.header}>
            <Text style={styles.name} numberOfLines={1}>
              {s.service}
            </Text>
            <Text style={styles.numbers}>
              {s.bookings} 次{s.revenue > 0 ? ` · ${formatMoney(s.revenue)}` : ''}
            </Text>
          </View>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${(s.bookings / max) * 100}%`, backgroundColor: serviceColor(s.service) },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm + 4,
  },
  row: {
    gap: spacing.xs + 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    ...type.body,
    flexShrink: 1,
  },
  numbers: {
    ...type.caption,
    ...type.time,
  },
  track: {
    height: 6,
    borderRadius: radius.xs,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.xs,
  },
});

import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, type } from '@/constants/theme';
import { formatPercent, type SegmentSummary } from '@/utils/customerAnalytics';

/** Customers per segment, each with a bar for its share of the future value. */
export function SegmentBreakdown({ segments }: { segments: SegmentSummary[] }) {
  return (
    <View style={styles.list}>
      {segments.map((s) => (
        <View key={s.segment} style={styles.row}>
          <View style={styles.header}>
            <Text style={styles.name} numberOfLines={1}>
              {s.segment}
            </Text>
            <Text style={styles.numbers}>
              {s.customers} 位 · {formatPercent(s.clvShare)}
            </Text>
          </View>
          {s.description ? <Text style={styles.description}>{s.description}</Text> : null}
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${s.clvShare * 100}%` }]} />
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
  description: {
    ...type.caption,
    fontSize: 12,
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
    backgroundColor: colors.accent,
  },
});

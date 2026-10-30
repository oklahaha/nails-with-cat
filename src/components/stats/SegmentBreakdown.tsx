import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { colors, pressedStyle, radius, spacing, type } from '@/constants/theme';
import { formatPercent, type SegmentSummary } from '@/utils/customerAnalytics';

/** Customers per segment, each with a bar for its share of the future value. Tapping one lists its customers. */
export function SegmentBreakdown({ segments }: { segments: SegmentSummary[] }) {
  return (
    <View style={styles.list}>
      {segments.map((s) => (
        <Pressable
          key={s.segment}
          onPress={() =>
            router.push({ pathname: '/segment-customers', params: { segment: s.segment } })
          }
          style={({ pressed }) => [styles.row, pressed && pressedStyle]}
          accessibilityRole="button"
          accessibilityLabel={`${s.segment}，${s.customers} 位，查看名單`}
        >
          <View style={styles.header}>
            <Text style={styles.name} numberOfLines={1}>
              {s.segment}
            </Text>
            <View style={styles.right}>
              <Text style={styles.numbers}>
                {s.customers} 位 · {formatPercent(s.clvShare)}
              </Text>
              <Icon name="chevronRight" color={colors.textTertiary} size={16} />
            </View>
          </View>
          {s.description ? <Text style={styles.description}>{s.description}</Text> : null}
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${s.clvShare * 100}%` }]} />
          </View>
        </Pressable>
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
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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

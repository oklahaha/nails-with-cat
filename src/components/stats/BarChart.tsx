import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, tint, type } from '@/constants/theme';

export type Bar = { key: string; label: string; value: number };

type Props = {
  bars: Bar[];
  formatValue: (value: number) => string;
  /** Highlighted bar, labelled with its value. Defaults to the tallest. */
  selectedKey?: string;
  /** Makes each column tappable, e.g. to pick a month. */
  onSelect?: (key: string) => void;
  height?: number;
};

/**
 * Single-series column chart in plain Views. Only the highlighted bar gets a
 * value label, so the chart stays quiet; tapping a column (the whole column,
 * not just the bar) selects it when `onSelect` is given.
 */
export function BarChart({ bars, formatValue, selectedKey, onSelect, height = 120 }: Props) {
  const max = Math.max(...bars.map((b) => b.value), 0);
  const tallest = bars.reduce<Bar | undefined>((m, b) => (!m || b.value > m.value ? b : m), undefined);
  const highlighted = selectedKey ?? tallest?.key;

  return (
    <View style={styles.chart}>
      {bars.map((bar) => {
        const active = bar.key === highlighted;
        // Tiny non-zero values still show a sliver
        const barHeight = max > 0 && bar.value > 0 ? Math.max((bar.value / max) * height, 2) : 0;
        return (
          <Pressable
            key={bar.key}
            onPress={onSelect ? () => onSelect(bar.key) : undefined}
            disabled={!onSelect}
            style={styles.column}
            accessibilityRole={onSelect ? 'button' : undefined}
            accessibilityLabel={`${bar.label} ${formatValue(bar.value)}`}
            accessibilityState={onSelect ? { selected: active } : undefined}
          >
            <View style={[styles.plot, { height: height + 18 }]}>
              {active ? (
                // A fixed-width wrapper lets the label overhang narrow columns
                <View style={styles.valueWrap}>
                  <Text style={styles.value}>{formatValue(bar.value)}</Text>
                </View>
              ) : null}
              <View
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    backgroundColor: active ? colors.accent : tint(colors.accent, 0.35),
                  },
                ]}
              />
            </View>
            <View style={styles.baseline} />
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {bar.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    flexDirection: 'row',
  },
  column: {
    flex: 1,
    alignItems: 'center',
  },
  plot: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'flex-end',
    // 2px surface gap between neighbouring bars
    paddingHorizontal: 1,
  },
  bar: {
    width: '70%',
    maxWidth: 28,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  value: {
    ...type.caption,
    ...type.time,
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  valueWrap: {
    width: 56,
    alignItems: 'center',
    marginBottom: 2,
  },
  baseline: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  label: {
    ...type.caption,
    fontSize: 11,
    marginTop: spacing.xs,
    color: colors.textTertiary,
  },
  labelActive: {
    color: colors.text,
    fontWeight: '600',
  },
});

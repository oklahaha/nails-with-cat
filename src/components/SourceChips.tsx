/** 來源 (how the customer found the studio) as tappable chips, for the Android / web customer forms. */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CUSTOMER_SOURCES } from '@/constants/customerSources';
import { colors, pressedStyle, radius, spacing } from '@/constants/theme';

/** Tapping the picked chip again clears it ('' = not recorded). */
export function SourceChips({ value, onChange }: { value: string; onChange: (source: string) => void }) {
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel="來源">
      {CUSTOMER_SOURCES.map((source) => {
        const selected = source === value;
        return (
          <Pressable
            key={source}
            onPress={() => onChange(selected ? '' : source)}
            style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && pressedStyle]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.text, selected && styles.textSelected]}>{source}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  text: { fontSize: 15, color: colors.text },
  textSelected: { color: colors.onAccent, fontWeight: '600' },
});

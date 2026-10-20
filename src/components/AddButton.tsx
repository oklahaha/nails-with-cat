import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/Icon';
import { colors, pressedStyle, spacing } from '@/constants/theme';

type Props = {
  /** Prefill the form's date (YYYY-MM-DD). */
  date?: string;
};

/** Round floating "+" button that opens the Add Appointment modal. */
export function AddButton({ date }: Props) {
  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/add-appointment', params: date ? { date } : {} })
      }
      style={({ pressed }) => [styles.fab, pressed && pressedStyle]}
      accessibilityRole="button"
      accessibilityLabel="新增預約"
    >
      <Icon name="add" color={colors.onAccent} size={30} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    // Warm-tinted shadow to match the background
    shadowColor: '#0A0605',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});

import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/Icon';
import { colors, spacing } from '@/constants/theme';

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
      style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
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
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabPressed: {
    opacity: 0.85,
  },
});

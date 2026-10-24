import { router } from 'expo-router';
import { Animated, Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/Icon';
import { colors, pressedStyle, spacing } from '@/constants/theme';
import { useTabBarVisibility } from '@/hooks/useTabBarVisibility';

type Props = {
  /** Prefill the form's date (YYYY-MM-DD). */
  date?: string;
  /** Do something else instead of opening Add Appointment (e.g. add a customer). */
  onPress?: () => void;
  accessibilityLabel?: string;
};

/**
 * Round floating "+" button; opens the Add Appointment modal by default.
 * Sits above the floating tab bar and slides down with it when it hides.
 */
export function AddButton({ date, onPress, accessibilityLabel = '新增預約' }: Props) {
  const { inset, progress } = useTabBarVisibility();
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-inset, 0] });

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
      <Pressable
        onPress={
          onPress ??
          (() => router.push({ pathname: '/add-appointment', params: date ? { date } : {} }))
        }
        style={({ pressed }) => [styles.fab, pressed && pressedStyle]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <Icon name="add" color={colors.onAccent} size={30} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
  },
  fab: {
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

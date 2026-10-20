import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { colors, pressedStyle, radius, spacing, type } from '@/constants/theme';

type Props = {
  /** Show a spinner instead of an icon. */
  loading?: boolean;
  icon?: IconName;
  title: string;
  message?: string;
  /** Error messages are shown in the danger colour. */
  tone?: 'default' | 'error';
  action?: { label: string; onPress: () => void };
};

/** Centered loading / empty / error state for a screen or list. */
export function StateView({ loading, icon, title, message, tone = 'default', action }: Props) {
  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} />
      ) : icon ? (
        <View style={styles.iconWrap}>
          <Icon name={icon} color={colors.textSecondary} size={28} />
        </View>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      {message ? (
        <Text style={[styles.message, tone === 'error' && styles.messageError]}>{message}</Text>
      ) : null}
      {action ? (
        <Pressable
          onPress={action.onPress}
          style={({ pressed }) => [styles.button, pressed && pressedStyle]}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl * 2,
    backgroundColor: colors.background,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  title: {
    ...type.heading,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  message: {
    ...type.caption,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xs,
    textAlign: 'center',
    maxWidth: 280,
  },
  messageError: {
    color: colors.danger,
  },
  button: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  buttonText: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: '700',
  },
});

/**
 * Sign in — shown instead of the app until an allowed Google account signs
 * in (see the root layout's Stack.Protected). iOS uses sign-in.ios.tsx.
 */
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GOOGLE_SIGN_IN_CONFIGURED, useGoogleSignIn } from '@/auth/useGoogleSignIn';
import { Icon } from '@/components/Icon';
import { StateView } from '@/components/StateView';
import { colors, pressedStyle, radius, spacing, type } from '@/constants/theme';

export default function SignInScreen() {
  if (!GOOGLE_SIGN_IN_CONFIGURED) {
    return (
      <StateView
        icon="person"
        title="未設定 Google 登入"
        message="請在 .env.local 加入 Google 登入的 Client ID"
        tone="error"
      />
    );
  }
  return <SignIn />;
}

function SignIn() {
  const { ready, busy, start } = useGoogleSignIn();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Icon name="calendar" color={colors.accent} size={64} />
        <Text style={styles.title}>預約時間表</Text>
        <Text style={styles.subtitle}>請用已登記的 Google 帳戶登入</Text>
      </View>
      <Pressable
        onPress={start}
        disabled={!ready || busy}
        style={({ pressed }) => [
          styles.button,
          (!ready || busy) && styles.buttonDisabled,
          pressed && pressedStyle,
        ]}
        accessibilityRole="button"
      >
        {busy ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <>
            <Icon name="person" color={colors.onAccent} size={20} />
            <Text style={styles.buttonText}>使用 Google 登入</Text>
          </>
        )}
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  title: {
    ...type.title,
    fontSize: 28,
  },
  subtitle: {
    ...type.caption,
    fontSize: 15,
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.onAccent,
    fontSize: 17,
    fontWeight: '700',
  },
});

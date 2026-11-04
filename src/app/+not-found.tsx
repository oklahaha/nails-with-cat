import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: '找不到頁面' }} />
      <View style={styles.container}>
        <Text style={styles.title}>此頁面不存在</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>回到時間表</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  link: {
    marginTop: spacing.md,
  },
  linkText: {
    fontSize: 16,
    color: colors.accent,
    fontWeight: '600',
  },
});

/**
 * Root layout — Expo Router stack navigator.
 *
 * Routes live under src/app/ (file-based routing).
 * Non-route code (components, services, types) stays outside this folder.
 */
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/constants/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.text, fontWeight: '600' },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="index"
          options={{ title: '預約一覽' }}
        />
        <Stack.Screen
          name="add-appointment"
          options={{ title: '新增預約', presentation: 'modal' }}
        />
      </Stack>
    </>
  );
}

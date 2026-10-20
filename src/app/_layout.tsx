/**
 * Root layout — the tab navigator plus the Add Appointment modal on top.
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
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.text, fontWeight: '600' },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="add-appointment"
          options={{ title: '新增預約', presentation: 'modal' }}
        />
      </Stack>
    </>
  );
}

/**
 * Root layout — the tab navigator plus the appointment details,
 * Add / Edit Appointment, customer details and Add Customer modals on top.
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
          name="appointment-details"
          options={{ title: '預約詳情', presentation: 'modal' }}
        />
        <Stack.Screen
          name="customer-details"
          options={{ title: '顧客資料', presentation: 'modal' }}
        />
        <Stack.Screen
          name="add-customer"
          options={{ title: '新增顧客', presentation: 'modal' }}
        />
        <Stack.Screen
          name="add-appointment"
          options={({ route }) => ({
            // The same form edits an appointment when opened with an id
            title: (route.params as { id?: string } | undefined)?.id ? '編輯預約' : '新增預約',
            presentation: 'modal',
          })}
        />
      </Stack>
    </>
  );
}

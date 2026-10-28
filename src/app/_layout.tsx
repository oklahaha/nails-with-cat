/**
 * Root layout — the tab navigator plus the appointment details,
 * Add / Edit Appointment, customer details and Add Customer modals on top,
 * all behind Google sign-in: until an allowed account signs in, only the
 * sign-in screen is reachable.
 *
 * Routes live under src/app/ (file-based routing).
 * Non-route code (components, services, types) stays outside this folder.
 */
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';

import { useSession } from '@/auth/session';
import { colors } from '@/constants/theme';
import { useResumeWrites } from '@/hooks/resumeWrites';
import { useUpcomingSync } from '@/hooks/useUpcomingSync';
import { useNotifications } from '@/notifications/notifications';

/** Background work that only runs once signed in. */
function SignedInSync() {
  // Sends saves a closed app left unsent
  useResumeWrites();
  // Asks for notification permission and opens bookings from tapped notifications
  useNotifications();
  // Feeds the next two weeks to the iOS home screen widget and the reminders
  useUpcomingSync();
  return null;
}

export default function RootLayout() {
  const signedIn = useSession() !== null;

  return (
    <>
      <StatusBar style="light" />
      {signedIn ? <SignedInSync /> : null}
      <Stack
        screenOptions={{
          // On iOS the modal headers keep the system look: Liquid Glass buttons over the sheet
          headerStyle: Platform.OS === 'ios' ? undefined : { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.text, fontWeight: '600' },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
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
        </Stack.Protected>
      </Stack>
    </>
  );
}

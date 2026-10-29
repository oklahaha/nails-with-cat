/**
 * Root layout — the tab navigator plus the appointment details,
 * Add / Edit Appointment, customer details and Add Customer modals on top.
 *
 * Routes live under src/app/ (file-based routing).
 * Non-route code (components, services, types) stays outside this folder.
 */
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { WhatsAppConfirmationDialog } from '@/components/WhatsAppConfirmationDialog';
import { stackScreenOptions } from '@/constants/stackOptions';
import { useResumeWrites } from '@/hooks/resumeWrites';
import { useUpcomingSync } from '@/hooks/useUpcomingSync';
import { useNotifications } from '@/notifications/notifications';

export default function RootLayout() {
  // Sends saves a closed app left unsent
  useResumeWrites();
  // Asks for notification permission and opens bookings from tapped notifications
  useNotifications();
  // Feeds the next two weeks to the iOS home screen widget and the reminders
  useUpcomingSync();

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="appointment-details"
          // Its own stack draws the header (appointment-details/_layout)
          options={{ headerShown: false, presentation: 'modal' }}
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
      {/* After a new booking is created, offers to WhatsApp the customer */}
      <WhatsAppConfirmationDialog />
    </>
  );
}

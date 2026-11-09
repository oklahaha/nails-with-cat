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
import { useEffect } from 'react';

import { useSession } from '@/auth/session';
import { RootAlerts } from '@/components/RootAlerts';
import { WhatsAppConfirmationDialog } from '@/components/WhatsAppConfirmationDialog';
import { stackScreenOptions } from '@/constants/stackOptions';
import { useResumeWrites } from '@/hooks/resumeWrites';
import { syncUpcoming, useUpcomingSync } from '@/hooks/useUpcomingSync';
import { useNotifications } from '@/notifications/notifications';
import { PHOTO_KINDS, type PhotoKind } from '@/utils/appointmentPhotos';

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
  useEffect(() => {
    if (!signedIn) void syncUpcoming();
  }, [signedIn]);

  return (
    <>
      <StatusBar style="light" />
      {signedIn ? <SignedInSync /> : null}
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="appointment-details"
            // Its own stack draws the header (appointment-details/_layout)
            options={{ headerShown: false, presentation: 'modal' }}
          />
          <Stack.Screen
            name="appointment-photo"
            options={({ route }) => ({
              title:
                (route.params as { kind?: PhotoKind } | undefined)?.kind === 'finished'
                  ? PHOTO_KINDS.finished.title
                  : PHOTO_KINDS.reference.title,
              // Over the sheet it was opened from, which stays as it was
              presentation: 'fullScreenModal',
            })}
          />
          <Stack.Screen
            name="gallery-photo"
            options={{ title: '作品', presentation: 'fullScreenModal' }}
          />
          <Stack.Screen
            name="customer-details"
            options={{ title: '顧客資料', presentation: 'modal' }}
          />
          <Stack.Screen
            name="segment-customers"
            options={({ route }) => ({
              title: (route.params as { segment?: string } | undefined)?.segment ?? '顧客分群',
              presentation: 'modal',
            })}
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
      {/* After a new booking is created, offers to WhatsApp the customer */}
      <WhatsAppConfirmationDialog />
      <RootAlerts />
    </>
  );
}

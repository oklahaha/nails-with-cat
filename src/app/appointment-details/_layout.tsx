/**
 * The appointment details modal, with its own stack so the customer row
 * pushes 顧客資料 inside the sheet (with a back button), as iOS apps do,
 * rather than opening another sheet over it.
 */
import { Stack } from 'expo-router';

import { stackScreenOptions } from '@/constants/stackOptions';

export default function AppointmentDetailsLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ title: '預約詳情' }} />
      <Stack.Screen name="customer" options={{ title: '顧客資料' }} />
    </Stack>
  );
}

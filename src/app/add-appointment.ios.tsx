/**
 * Add / Edit Appointment — the SwiftUI AppointmentForm as its own modal.
 * Prefilled from `date` / `customerName`, or edits the cached appointment `id`.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { AppointmentForm } from '@/components/swiftui/AppointmentForm';
import { SwiftStateView } from '@/components/swiftui/SwiftStateView';
import { findCachedAppointment } from '@/hooks/useAppointments';

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function AddAppointmentScreen() {
  const params = useLocalSearchParams<{ id?: string; date?: string; customerName?: string }>();
  const [editing] = useState(() => (params.id ? findCachedAppointment(params.id) : undefined));

  if (params.id && !editing) {
    return (
      <SwiftStateView
        title="找不到此預約"
        message="請返回時間表，再揀選要修改的預約。"
        action={{ label: '返回', onPress: close }}
      />
    );
  }

  return (
    <AppointmentForm
      editing={editing}
      defaults={{ date: params.date, customerName: params.customerName }}
      onClose={close}
      onSaved={close}
    />
  );
}

/**
 * Appointment details modal — SwiftUI Form. 修改 (header) swaps the sheet to
 * AppointmentForm in place, with 刪除預約 at the end of the form.
 * Delete / edit still use Apps Script API.
 */
import {
  Button,
  Form,
  LabeledContent,
  Section,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { AppointmentForm } from '@/components/swiftui/AppointmentForm';
import { SwiftModal } from '@/components/swiftui/SwiftModal';
import { SwiftStateView } from '@/components/swiftui/SwiftStateView';
import { serviceColor, usesHandOrFoot } from '@/constants/services';
import { findCachedAppointment, removeCachedAppointment } from '@/hooks/useAppointments';
import { deleteAppointment, isUsingMockApi } from '@/services/appointmentsApi';
import { showAlert } from '@/utils/alert';
import { appointmentTitle } from '@/utils/appointmentTitle';
import { formatDateHeader } from '@/utils/groupByDate';

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function AppointmentDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [appointment, setAppointment] = useState(() => (id ? findCachedAppointment(id) : undefined));
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!appointment) {
    return (
      <SwiftStateView
        title="找不到此預約"
        message="請返回時間表，再揀選預約。"
        action={{ label: '返回', onPress: close }}
      />
    );
  }

  const color = serviceColor(appointment.service);
  const phone = appointment.phone?.trim();
  const hasEnd = Boolean(appointment.endTime && appointment.endTime !== appointment.time);
  const rows = [
    { label: '日期', value: formatDateHeader(appointment.date) },
    {
      label: '時間',
      value: `${appointment.time}${hasEnd ? ` – ${appointment.endTime}` : ''}${
        appointment.durationMinutes ? `（${appointment.durationMinutes} 分鐘）` : ''
      }`,
    },
    {
      label: '手/腳',
      value: usesHandOrFoot(appointment.service) ? appointment.handOrFoot : undefined,
    },
    { label: '收費', value: appointment.price != null ? `$${appointment.price}` : '' },
    { label: '狀態', value: appointment.status },
    { label: '電話', value: phone },
    { label: '備注', value: appointment.notes },
  ].filter((row) => row.value);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await deleteAppointment(appointment.id);
      removeCachedAppointment(appointment.id);
      if (isUsingMockApi) {
        showAlert('已刪除（模擬）', '目前使用 mock API，連上 Google Sheet 後會真正刪除。');
      }
      close();
    } catch (e) {
      showAlert('刪除失敗', e instanceof Error ? e.message : '未知錯誤');
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    showAlert(
      '刪除預約？',
      `${appointmentTitle(appointment)} ${formatDateHeader(appointment.date)} ${appointment.time}\n刪除後無法復原。`,
      [
        { text: '取消', style: 'cancel' },
        { text: '刪除', style: 'destructive', onPress: () => void handleDelete() },
      ]
    );
  };

  if (editing) {
    // 修改 turns this sheet into the form in place; ✕ goes back to the details
    return (
      <AppointmentForm
        editing={appointment}
        onClose={() => setEditing(false)}
        onSaved={(saved) => {
          setAppointment({ ...appointment, ...saved, phone: saved.phone || appointment.phone });
          setEditing(false);
        }}
      >
        <Section>
          <Button
            label={deleting ? '刪除中…' : '刪除預約'}
            role="destructive"
            onPress={confirmDelete}
          />
        </Section>
      </AppointmentForm>
    );
  }

  return (
    <SwiftModal onClose={close} onEdit={() => setEditing(true)}>
      <Form>
        <Section>
          <VStack spacing={8} alignment="leading" modifiers={[padding({ vertical: 8 })]}>
            <Text modifiers={[font({ size: 22, weight: 'bold' })]}>
              {appointmentTitle(appointment)}
            </Text>
            <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(color)]}>
              {appointment.service}
            </Text>
          </VStack>
        </Section>

        <Section title="詳情">
          {rows.map((row) => (
            <LabeledContent key={row.label} label={row.label}>
              <Text>{row.value}</Text>
            </LabeledContent>
          ))}
        </Section>

      </Form>
    </SwiftModal>
  );
}

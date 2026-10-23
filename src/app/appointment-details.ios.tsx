/**
 * Appointment details modal — SwiftUI Form. Delete / edit still use Apps Script API.
 */
import {
  Button,
  Form,
  HStack,
  LabeledContent,
  Section,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  controlSize,
  font,
  foregroundStyle,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { SwiftHost } from '@/components/swiftui/SwiftHost';
import { SwiftStateView } from '@/components/swiftui/SwiftStateView';
import { serviceColor } from '@/constants/services';
import { colors } from '@/constants/theme';
import { findCachedAppointment, removeCachedAppointment } from '@/hooks/useAppointments';
import { deleteAppointment, isUsingMockApi } from '@/services/appointmentsApi';
import { showAlert } from '@/utils/alert';
import { appointmentTitle } from '@/utils/appointmentTitle';
import { formatDateHeader } from '@/utils/groupByDate';
import { openWhatsApp, reminderMessage } from '@/utils/whatsapp';

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function AppointmentDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [appointment] = useState(() => (id ? findCachedAppointment(id) : undefined));
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
    { label: '手/腳', value: appointment.handOrFoot },
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

  return (
    <SwiftHost>
      <Form>
        <Section>
          <VStack spacing={8} alignment="leading" modifiers={[padding({ vertical: 8 })]}>
            <Text modifiers={[font({ size: 22, weight: 'bold' })]}>
              {appointmentTitle(appointment)}
            </Text>
            <Text modifiers={[font({ size: 15, weight: 'semibold' }), tint(color)]}>
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

        {phone ? (
          <Section>
            <Button
              label="WhatsApp 聯絡"
              systemImage="message.fill"
              onPress={() => void openWhatsApp(phone, reminderMessage(appointment))}
              modifiers={[buttonStyle('borderedProminent'), tint(colors.whatsapp)]}
            />
          </Section>
        ) : null}

        <Section>
          <HStack spacing={12}>
            <Button
              label={deleting ? '刪除中…' : '刪除'}
              role="destructive"
              systemImage="trash"
              onPress={confirmDelete}
              modifiers={[buttonStyle('bordered'), controlSize('large')]}
            />
            <Button
              label="修改"
              systemImage="pencil"
              onPress={() =>
                router.replace({
                  pathname: '/add-appointment',
                  params: { id: appointment.id },
                })
              }
              modifiers={[
                buttonStyle('borderedProminent'),
                controlSize('large'),
                tint(colors.accent),
              ]}
            />
          </HStack>
          <Text
            modifiers={[
              font({ size: 12 }),
              foregroundStyle({ type: 'hierarchical', style: 'tertiary' }),
            ]}
          >
            修改會開啟編輯表單；儲存後返回時間表。
          </Text>
        </Section>
      </Form>
    </SwiftHost>
  );
}

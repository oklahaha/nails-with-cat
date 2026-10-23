/**
 * Customer details — SwiftUI Form. update/delete + history still use Apps Script API.
 */
import {
  Button,
  Form,
  HStack,
  LabeledContent,
  List,
  Section,
  Text,
  TextField,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  controlSize,
  font,
  foregroundStyle,
  listStyle,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

import { AppointmentRow } from '@/components/swiftui/AppointmentRow';
import { SwiftHost } from '@/components/swiftui/SwiftHost';
import { SwiftStateView } from '@/components/swiftui/SwiftStateView';
import { colors } from '@/constants/theme';
import { useCustomerAppointments } from '@/hooks/useAppointments';
import {
  findCachedCustomer,
  removeCachedCustomer,
  updateCachedCustomer,
} from '@/hooks/useCustomers';
import { deleteCustomer, isUsingMockApi, updateCustomer } from '@/services/appointmentsApi';
import type { Customer, CustomerKey } from '@/types/customer';
import { showAlert } from '@/utils/alert';
import { todayIsoDate } from '@/utils/dates';
import { formatPhone, localPhone } from '@/utils/phone';
import { openWhatsApp } from '@/utils/whatsapp';

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/customers');
}

export default function CustomerDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string; name: string }>();
  const [customer, setCustomer] = useState<Customer | undefined>(() =>
    findCachedCustomer({ id: params.id, name: params.name ?? '' })
  );
  const [editing, setEditing] = useState(false);
  const nameText = useNativeState('');
  const phoneText = useNativeState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'saving' | 'deleting' | null>(null);
  const [showAllPast, setShowAllPast] = useState(false);

  const history = useCustomerAppointments(
    customer ? { id: customer.id || undefined, name: customer.name } : undefined
  );

  const today = todayIsoDate();
  const historyAppointments = history.appointments;
  const { upcoming, past } = useMemo(() => {
    const upcomingList: typeof historyAppointments = [];
    const pastList: typeof historyAppointments = [];
    for (const apt of historyAppointments) {
      const isUpcoming =
        apt.date > today || (apt.date === today && apt.status !== '已完成');
      if (isUpcoming) upcomingList.push(apt);
      else pastList.push(apt);
    }
    return {
      upcoming: [...upcomingList].reverse(),
      past: pastList,
    };
  }, [historyAppointments, today]);

  if (!customer) {
    return (
      <SwiftStateView
        title="找不到此顧客"
        message="請返回顧客資料，再揀選顧客。"
        systemImage="person"
        action={{ label: '返回', onPress: close }}
      />
    );
  }

  const key: CustomerKey = { id: customer.id || undefined, name: customer.name };

  const startEditing = () => {
    nameText.set(customer.name);
    phoneText.set(localPhone(customer.phone));
    setNameError(null);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!nameText.get().trim()) {
      setNameError('請輸入顧客姓名');
      return;
    }
    try {
      setBusy('saving');
      const updated = await updateCustomer(key, {
        name: nameText.get().trim(),
        phone: phoneText.get(),
      });
      updateCachedCustomer(key, updated);
      setCustomer(updated);
      setEditing(false);
      if (isUsingMockApi) {
        showAlert('已儲存（模擬）', '目前使用 mock API，連上 Google Sheet 後會真正寫入。');
      }
    } catch (e) {
      showAlert('儲存失敗', e instanceof Error ? e.message : '未知錯誤');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    try {
      setBusy('deleting');
      await deleteCustomer(key);
      removeCachedCustomer(key);
      if (isUsingMockApi) {
        showAlert('已刪除（模擬）', '目前使用 mock API，連上 Google Sheet 後會真正刪除。');
      }
      close();
    } catch (e) {
      showAlert('刪除失敗', e instanceof Error ? e.message : '未知錯誤');
      setBusy(null);
    }
  };

  const confirmDelete = () => {
    showAlert('刪除顧客？', `${customer.name}\n顧客的預約記錄會保留。刪除後無法復原。`, [
      { text: '取消', style: 'cancel' },
      { text: '刪除', style: 'destructive', onPress: () => void handleDelete() },
    ]);
  };

  const visiblePast = showAllPast ? past : past.slice(0, 10);

  return (
    <SwiftHost>
      {editing ? (
        <Form>
          <Section title="修改顧客">
            <Text modifiers={[font({ size: 28, weight: 'bold' }), tint(colors.accent)]}>
              {Array.from(nameText.get() || customer.name)[0] ?? ''}
            </Text>
            <TextField
              placeholder="顧客姓名"
              text={nameText}
              onTextChange={() => setNameError(null)}
            />
            {nameError ? (
              <Text modifiers={[font({ size: 13 }), tint(colors.danger)]}>{nameError}</Text>
            ) : null}
            {nameText.get().trim() !== customer.name ? (
              <Text
                modifiers={[
                  font({ size: 12 }),
                  foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                ]}
              >
                改名後，此顧客的預約記錄亦會一併更新。
              </Text>
            ) : null}
            <TextField placeholder="電話" text={phoneText} />
          </Section>
          <Section>
            <HStack spacing={12}>
              <Button
                label="取消"
                onPress={() => setEditing(false)}
                modifiers={[buttonStyle('bordered'), controlSize('large')]}
              />
              <Button
                label={busy === 'saving' ? '儲存中…' : '儲存'}
                onPress={() => void handleSave()}
                modifiers={[
                  buttonStyle('borderedProminent'),
                  controlSize('large'),
                  tint(colors.accent),
                ]}
              />
            </HStack>
          </Section>
        </Form>
      ) : (
        <List modifiers={[listStyle('insetGrouped')]}>
          <Section>
            <Text modifiers={[font({ size: 28, weight: 'bold' }), tint(colors.accent)]}>
              {Array.from(customer.name)[0] ?? ''}
            </Text>
            <Text modifiers={[font({ size: 22, weight: 'bold' })]}>{customer.name}</Text>
            <LabeledContent label="電話">
              <Text>{formatPhone(customer.phone) || '未有電話'}</Text>
            </LabeledContent>
            {customer.id ? (
              <LabeledContent label="顧客ID">
                <Text
                  modifiers={[
                    foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                  ]}
                >
                  {customer.id}
                </Text>
              </LabeledContent>
            ) : null}
          </Section>

          <Section>
            <HStack spacing={8}>
              {customer.phone ? (
                <Button
                  label="WhatsApp"
                  systemImage="message.fill"
                  onPress={() => void openWhatsApp(customer.phone)}
                  modifiers={[buttonStyle('borderedProminent'), tint(colors.whatsapp)]}
                />
              ) : null}
              <Button
                label="新增預約"
                systemImage="plus"
                onPress={() =>
                  router.replace({
                    pathname: '/add-appointment',
                    params: { customerName: customer.name },
                  })
                }
                modifiers={[buttonStyle('bordered'), tint(colors.accent)]}
              />
            </HStack>
          </Section>

          <Section title="預約記錄">
            {history.loading ? (
              <Text
                modifiers={[
                  foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                ]}
              >
                載入中…
              </Text>
            ) : history.error && history.appointments.length === 0 ? (
              <Button
                label="重試"
                onPress={() => void history.reload()}
                modifiers={[buttonStyle('bordered')]}
              />
            ) : history.appointments.length === 0 ? (
              <Text
                modifiers={[
                  foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                ]}
              >
                未有預約記錄
              </Text>
            ) : (
              <LabeledContent label="來店次數">
                <Text>{past.length} 次</Text>
              </LabeledContent>
            )}
          </Section>

          {upcoming.length > 0 ? (
            <Section title="即將預約">
              {upcoming.map((apt) => (
                <AppointmentRow key={apt.id} appointment={apt} />
              ))}
            </Section>
          ) : null}

          {past.length > 0 ? (
            <Section title="過往記錄">
              {visiblePast.map((apt) => (
                <AppointmentRow key={apt.id} appointment={apt} />
              ))}
              {!showAllPast && past.length > 10 ? (
                <Button
                  label={`顯示全部 ${past.length} 項`}
                  onPress={() => setShowAllPast(true)}
                  modifiers={[buttonStyle('plain'), tint(colors.accent)]}
                />
              ) : null}
            </Section>
          ) : null}

          <Section>
            <HStack spacing={12}>
              <Button
                label={busy === 'deleting' ? '刪除中…' : '刪除'}
                role="destructive"
                systemImage="trash"
                onPress={confirmDelete}
                modifiers={[buttonStyle('bordered'), controlSize('large')]}
              />
              <Button
                label="修改"
                systemImage="pencil"
                onPress={startEditing}
                modifiers={[
                  buttonStyle('borderedProminent'),
                  controlSize('large'),
                  tint(colors.accent),
                ]}
              />
            </HStack>
          </Section>
        </List>
      )}
    </SwiftHost>
  );
}

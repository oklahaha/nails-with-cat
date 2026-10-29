/**
 * Customer details — SwiftUI List laid out like iOS Contacts: avatar, name and
 * 新增預約 at the top, then contact info, visit summary and the booking
 * history (rows led by the date). 修改 edits in place; update/delete +
 * history still use Apps Script API.
 */
import {
  Button,
  Form,
  HStack,
  LabeledContent,
  List,
  ProgressView,
  Section,
  Text,
  TextField,
  VStack,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  background,
  buttonStyle,
  controlSize,
  font,
  foregroundStyle,
  frame,
  listRowBackground,
  listStyle,
  multilineTextAlignment,
  scrollDismissesKeyboard,
  shapes,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { router, useLocalSearchParams, useSegments } from 'expo-router';
import { useMemo, useState } from 'react';

import { AppointmentRow } from '@/components/swiftui/AppointmentRow';
import { DeleteConfirmButton } from '@/components/swiftui/DeleteConfirmButton';
import { SwiftModal } from '@/components/swiftui/SwiftModal';
import { SwiftStateView } from '@/components/swiftui/SwiftStateView';
import { glassButton, glassProminentButton } from '@/components/swiftui/glass';
import { colors } from '@/constants/theme';
import { useCustomerAppointments } from '@/hooks/useAppointments';
import { removeCustomer, saveCustomer } from '@/hooks/customerWrites';
import { findCachedCustomer } from '@/hooks/useCustomers';
import { NO_SHOW } from '@/types/appointment';
import type { Customer } from '@/types/customer';
import { formatShortDate, todayIsoDate } from '@/utils/dates';
import { formatPhone, localPhone } from '@/utils/phone';

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/customers');
}

export default function CustomerDetailsScreen() {
  // `edit=1` (修改 in the list's long-press menu) opens straight in edit mode
  const params = useLocalSearchParams<{ id?: string; name: string; edit?: string }>();
  // Pushed inside the appointment details sheet, whose stack draws a back button
  const pushed = useSegments()[0] === 'appointment-details';
  const [customer, setCustomer] = useState<Customer | undefined>(() =>
    findCachedCustomer({ id: params.id, name: params.name ?? '' })
  );
  const editFirst = params.edit === '1' && customer ? customer : undefined;
  const [editing, setEditing] = useState(editFirst != null);
  const nameText = useNativeState(editFirst?.name ?? '');
  // Mirrors nameText for rendering: reading an ObservableState doesn't re-render
  const [nameDraft, setNameDraft] = useState(editFirst?.name ?? '');
  const phoneText = useNativeState(editFirst ? localPhone(editFirst.phone) : '');
  const [nameError, setNameError] = useState<string | null>(null);
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
        apt.date > today || (apt.date === today && apt.status !== '已完成' && apt.status !== NO_SHOW);
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

  const startEditing = () => {
    nameText.set(customer.name);
    setNameDraft(customer.name);
    phoneText.set(localPhone(customer.phone));
    setNameError(null);
    setEditing(true);
  };

  const handleSave = () => {
    if (!nameText.get().trim()) {
      setNameError('請輸入顧客姓名');
      return;
    }
    // Shows at once and is sent in the background; a failure is reported then
    setCustomer(saveCustomer({ name: nameText.get().trim(), phone: phoneText.get() }, customer));
    setEditing(false);
  };

  const handleDelete = () => {
    // Disappears at once and is sent in the background; a failure brings it back
    removeCustomer(customer);
    close();
  };

  const visiblePast = showAllPast ? past : past.slice(0, 10);

  return (
    <SwiftModal
      // While editing, ✕ leaves edit mode instead of closing the sheet
      onClose={editing ? () => setEditing(false) : pushed ? undefined : close}
      onSave={editing ? handleSave : undefined}
      onEdit={startEditing}
    >
      {editing ? (
        <Form modifiers={[scrollDismissesKeyboard('immediately')]}>
          <Section title="修改顧客">
            <Text modifiers={[font({ size: 28, weight: 'bold' }), foregroundStyle(colors.accent)]}>
              {Array.from(nameDraft || customer.name)[0] ?? ''}
            </Text>
            <TextField
              placeholder="顧客姓名"
              text={nameText}
              onTextChange={(text) => {
                setNameDraft(text);
                setNameError(null);
              }}
            />
            {nameError ? (
              <Text modifiers={[font({ size: 13 }), foregroundStyle(colors.danger)]}>{nameError}</Text>
            ) : null}
            {nameDraft.trim() !== customer.name ? (
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
            <DeleteConfirmButton
              label="刪除顧客"
              title="刪除顧客？"
              message={`${customer.name}\n顧客的預約記錄會保留。刪除後無法復原。`}
              onConfirm={() => void handleDelete()}
            />
          </Section>
        </Form>
      ) : (
        <List modifiers={[listStyle('insetGrouped')]}>
          {/* Header as in iOS Contacts: avatar, name, then the main action */}
          <Section modifiers={[listRowBackground('clear')]}>
            <VStack spacing={12} modifiers={[frame({ maxWidth: Infinity })]}>
              <Text
                modifiers={[
                  font({ size: 36, weight: 'semibold' }),
                  foregroundStyle(colors.onAccent),
                  frame({ width: 88, height: 88 }),
                  background(colors.accent, shapes.circle()),
                ]}
              >
                {Array.from(customer.name)[0] ?? ''}
              </Text>
              <Text
                modifiers={[font({ size: 26, weight: 'bold' }), multilineTextAlignment('center')]}
              >
                {customer.name}
              </Text>
              <Button
                label="新增預約"
                systemImage="calendar.badge.plus"
                onPress={() =>
                  router.replace({
                    pathname: '/add-appointment',
                    params: { customerName: customer.name },
                  })
                }
                modifiers={[
                  glassProminentButton(),
                  tint(colors.accent),
                  controlSize('large'),
                  // The icon otherwise takes the accent and vanishes into the button
                  foregroundStyle('#FFFFFF'),
                ]}
              />
            </VStack>
          </Section>

          <Section>
            <LabeledContent label="電話">
              <Text>{formatPhone(customer.phone) || '未有電話'}</Text>
            </LabeledContent>
            {customer.id ? (
              <LabeledContent label="顧客ID">
                <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
                  {customer.id}
                </Text>
              </LabeledContent>
            ) : null}
          </Section>

          <Section title="預約記錄">
            {history.loading ? (
              <HStack spacing={8}>
                <ProgressView />
                <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
                  載入中…
                </Text>
              </HStack>
            ) : history.error && history.appointments.length === 0 ? (
              <Button
                label="重試"
                onPress={() => void history.reload()}
                modifiers={[glassButton()]}
              />
            ) : history.appointments.length === 0 ? (
              <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
                未有預約記錄
              </Text>
            ) : (
              <>
                <LabeledContent label="來店次數">
                  <Text>{past.length} 次</Text>
                </LabeledContent>
                <LabeledContent label="最近來店">
                  <Text>{past[0] ? formatShortDate(past[0].date) : '—'}</Text>
                </LabeledContent>
                <LabeledContent label="下次預約">
                  <Text>{upcoming[0] ? formatShortDate(upcoming[0].date) : '—'}</Text>
                </LabeledContent>
              </>
            )}
          </Section>

          {upcoming.length > 0 ? (
            <Section title="即將預約">
              {upcoming.map((apt) => (
                <AppointmentRow key={apt.id} appointment={apt} inCustomerHistory />
              ))}
            </Section>
          ) : null}

          {past.length > 0 ? (
            <Section title="過往記錄">
              {visiblePast.map((apt) => (
                <AppointmentRow key={apt.id} appointment={apt} inCustomerHistory />
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
        </List>
      )}
    </SwiftModal>
  );
}

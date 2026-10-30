/**
 * Appointment details modal — SwiftUI Form with the same sections, rows and
 * labels as AppointmentForm, read-only; the customer row pushes 顧客資料
 * inside the sheet (appointment-details/_layout).
 * 修改 (header) swaps the sheet to
 * AppointmentForm in place, with 刪除預約 at the end of the form. Bookings
 * with a paid 訂金 have 保留訂金, which marks the deposit as kept for the
 * customer's next booking.
 * Delete / edit still use Apps Script API.
 */
import {
  Button,
  Form,
  HStack,
  Image,
  LabeledContent,
  Section,
  Spacer,
  Text,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  contentShape,
  foregroundStyle,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { AppointmentForm } from '@/components/swiftui/AppointmentForm';
import { KeepDepositButton } from '@/components/swiftui/KeepDepositButton';
import { DeleteConfirmButton } from '@/components/swiftui/DeleteConfirmButton';
import { SwiftModal } from '@/components/swiftui/SwiftModal';
import { SwiftStateView } from '@/components/swiftui/SwiftStateView';
import {
  NAIL_EXTRAS,
  serviceColor,
  showsNailExtras,
  toComplexDesign,
  usesDeposit,
  usesHandOrFoot,
} from '@/constants/services';
import { colors } from '@/constants/theme';
import { removeAppointment } from '@/hooks/appointmentWrites';
import { findCachedAppointment } from '@/hooks/useAppointments';
import { useKeptDepositHint } from '@/hooks/useKeptDepositHint';
import {
  canKeepDeposit,
  hasCustomerActions,
  pushAppointmentCustomer,
} from '@/utils/appointmentActions';
import { appointmentTitle } from '@/utils/appointmentTitle';
import { formatDuration } from '@/utils/dates';
import { formatDateHeader } from '@/utils/groupByDate';
import { formatPhone } from '@/utils/phone';

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function AppointmentDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [appointment, setAppointment] = useState(() => (id ? findCachedAppointment(id) : undefined));
  const [editing, setEditing] = useState(false);
  const keptDepositHint = useKeptDepositHint(appointment);

  if (!appointment) {
    return (
      <SwiftStateView
        title="找不到此預約"
        message="請返回時間表，再揀選預約。"
        action={{ label: '返回', onPress: close }}
      />
    );
  }

  const isSpecial = appointment.service === '特別事項';
  const phone = appointment.phone?.trim();
  const duration = appointment.durationMinutes;

  const handleDelete = () => {
    // Disappears at once and is sent in the background; a failure brings it back
    removeAppointment(appointment);
    close();
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
          <DeleteConfirmButton
            label="刪除預約"
            title="刪除預約？"
            message={`${appointmentTitle(appointment)} ${formatDateHeader(appointment.date)} ${appointment.time}\n刪除後無法復原。`}
            onConfirm={() => void handleDelete()}
          />
        </Section>
      </AppointmentForm>
    );
  }

  return (
    <SwiftModal onClose={close} onEdit={() => setEditing(true)}>
      <Form>
        <Section>
          <HStack spacing={8}>
            <Image systemName="circle.fill" size={12} color={serviceColor(appointment.service)} />
            <Text modifiers={[foregroundStyle(colors.text)]}>活動</Text>
            <Spacer />
            <Text modifiers={[foregroundStyle(colors.accent)]}>{appointment.service}</Text>
          </HStack>
        </Section>

        {isSpecial ? (
          <Section title="特別事項">
            <Text>{appointment.notes || '—'}</Text>
          </Section>
        ) : (
          <Section title="顧客">
            {hasCustomerActions(appointment) ? (
              <Button
                onPress={() => pushAppointmentCustomer(appointment)}
                modifiers={[
                  buttonStyle('plain'),
                  accessibilityLabel(`查看 ${appointment.customerName} 的顧客資料`),
                ]}
              >
                {/* contentShape + Spacer make the whole row tappable, not only the name */}
                <HStack spacing={10} modifiers={[contentShape(shapes.rectangle())]}>
                  <Image systemName="person.fill" size={15} color={colors.textSecondary} />
                  <Text>{appointment.customerName}</Text>
                  <Spacer />
                  <Image systemName="chevron.right" size={13} color={colors.textSecondary} />
                </HStack>
              </Button>
            ) : (
              <HStack spacing={10}>
                <Image systemName="person.fill" size={15} color={colors.textSecondary} />
                <Text>{appointment.customerName || '—'}</Text>
              </HStack>
            )}
            {phone ? <Row label="電話" value={formatPhone(phone)} /> : null}
            {keptDepositHint ? (
              <Text modifiers={[foregroundStyle(colors.accent)]}>{keptDepositHint}</Text>
            ) : null}
          </Section>
        )}

        <Section title="時間">
          <Row label="日期" value={formatDateHeader(appointment.date)} />
          <Row label="開始" value={appointment.time} />
          {appointment.endTime ? (
            <Row
              label="完結"
              value={`${appointment.endTime}${duration ? `（${formatDuration(duration)}）` : ''}`}
            />
          ) : null}
        </Section>

        {isSpecial ? null : (
          <>
            <Section title="詳情">
              {usesHandOrFoot(appointment.service) ? (
                <Row label="手/腳" value={appointment.handOrFoot} />
              ) : null}
              {showsNailExtras(appointment.service, appointment.handOrFoot ?? '') ? (
                <>
                  <Row label="複雜款" value={toComplexDesign(appointment.complexDesign)} />
                  {NAIL_EXTRAS.map(({ key, label }) => (
                    <Row key={key} label={label} value={appointment[key] ? '是' : '否'} />
                  ))}
                </>
              ) : null}
              {usesDeposit(appointment.service) ? (
                <Row label="已付訂金" value={appointment.deposit ? '是' : '否'} />
              ) : null}
              {appointment.keepDeposit ? <Row label="保留訂金" value="是（下次預約用）" /> : null}
              <Row label="收費" value={appointment.price != null ? `$${appointment.price}` : ''} />
            </Section>

            <Section title="備注">
              <Text>{appointment.notes || '—'}</Text>
            </Section>

            <Section>
              <Row label="狀態" value={appointment.status} />
            </Section>

            {canKeepDeposit(appointment) ? (
              <Section>
                <KeepDepositButton appointment={appointment} onDone={setAppointment} />
              </Section>
            ) : null}
          </>
        )}
      </Form>
    </SwiftModal>
  );
}

/** A read-only row laid out like the form's pickers: label left, value right. */
function Row({ label, value }: { label: string; value?: string }) {
  return (
    <LabeledContent label={label}>
      <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
        {value || '—'}
      </Text>
    </LabeledContent>
  );
}

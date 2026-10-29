/**
 * Native list row for an appointment — tap opens details; WhatsApp button
 * when there's a phone. A long press on a customer booking offers 顧客資料
 * and No show.
 *
 * `inCustomerHistory` (顧客資料's booking history): the row leads with the
 * date instead of the time, the service is the title (the name is the
 * screen's), and there's no WhatsApp button or 顧客資料 item.
 */
import {
  Button,
  ContextMenu,
  HStack,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  contentShape,
  font,
  foregroundStyle,
  frame,
  monospacedDigit,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { memo } from 'react';

import { serviceColor } from '@/constants/services';
import { NO_SHOW, type Appointment } from '@/types/appointment';
import {
  hasCustomerActions,
  noShowLabel,
  openAppointmentCustomer,
  openAppointmentDetails,
  toggleNoShow,
} from '@/utils/appointmentActions';
import { appointmentTitle } from '@/utils/appointmentTitle';
import { parseIsoDate, WEEKDAY_LABELS } from '@/utils/dates';
import { openWhatsApp, reminderMessage } from '@/utils/whatsapp';

import { ownRowBackground, ownRowInsets } from './listRow';
import { WhatsAppButton } from './WhatsAppButton';

type Props = {
  appointment: Appointment;
  inCustomerHistory?: boolean;
};

const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
const tertiary = foregroundStyle({ type: 'hierarchical', style: 'tertiary' });

/** 11月2日 over 星期一, or over the year when it isn't this year's. */
function DateColumn({ date }: { date: string }) {
  const d = parseIsoDate(date);
  const sub =
    d.getFullYear() === new Date().getFullYear()
      ? `星期${WEEKDAY_LABELS[d.getDay()]}`
      : `${d.getFullYear()}年`;
  return (
    <VStack spacing={2} alignment="leading" modifiers={[frame({ width: 64, alignment: 'leading' })]}>
      <Text modifiers={[font({ size: 16, weight: 'bold' }), monospacedDigit()]}>
        {`${d.getMonth() + 1}月${d.getDate()}日`}
      </Text>
      <Text modifiers={[font({ size: 13 }), tertiary]}>{sub}</Text>
    </VStack>
  );
}

export const AppointmentRow = memo(function AppointmentRow({
  appointment,
  inCustomerHistory = false,
}: Props) {
  const phone = inCustomerHistory ? undefined : appointment.phone?.trim();
  const title = appointmentTitle(appointment);
  const hasEnd = Boolean(appointment.endTime && appointment.endTime !== appointment.time);
  const color = serviceColor(appointment.service);
  const meta = [
    // The history's rows show the time here, since the date leads
    inCustomerHistory
      ? hasEnd
        ? `${appointment.time}–${appointment.endTime}`
        : appointment.time
      : null,
    appointment.service.includes('甲') ? appointment.handOrFoot : null,
    appointment.price ? `$${appointment.price}` : null,
    appointment.status === '已完成' || appointment.status === NO_SHOW ? appointment.status : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const menu = hasCustomerActions(appointment);
  const content = (
    // With the menu, the row draws its own background so a long press lifts all of it
    <HStack spacing={8} modifiers={menu ? ownRowBackground(6) : undefined}>
      <Button
        onPress={() => openAppointmentDetails(appointment)}
        modifiers={[buttonStyle('plain'), padding({ vertical: 4 })]}
      >
        {/* contentShape + Spacer make the whole row tappable, not only the text */}
        <HStack spacing={10} modifiers={[contentShape(shapes.rectangle())]}>
          {inCustomerHistory ? (
            <DateColumn date={appointment.date} />
          ) : (
            <VStack spacing={2} alignment="leading" modifiers={[padding({ trailing: 4 })]}>
              <Text modifiers={[font({ size: 16, weight: 'bold' })]}>{appointment.time}</Text>
              {hasEnd ? (
                <Text modifiers={[font({ size: 13 }), tertiary]}>{appointment.endTime}</Text>
              ) : null}
            </VStack>
          )}

          <VStack spacing={3} alignment="leading">
            {inCustomerHistory ? (
              <Text
                modifiers={[font({ size: 17, weight: 'semibold' }), foregroundStyle(color)]}
              >
                {appointment.service}
              </Text>
            ) : (
              <Text modifiers={[font({ size: 17, weight: 'semibold' })]}>{title}</Text>
            )}
            {inCustomerHistory ? (
              meta ? (
                <Text modifiers={[font({ size: 14 }), monospacedDigit(), secondary]}>{meta}</Text>
              ) : null
            ) : (
              <HStack spacing={4}>
                <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(color)]}>
                  {appointment.service}
                </Text>
                {meta ? (
                  <Text modifiers={[font({ size: 14 }), secondary]}>· {meta}</Text>
                ) : null}
              </HStack>
            )}
            {appointment.notes && appointment.notes !== title ? (
              <Text modifiers={[font({ size: 13 }), secondary]}>{appointment.notes}</Text>
            ) : null}
          </VStack>
          <Spacer />
        </HStack>
      </Button>

      {phone ? (
        <WhatsAppButton
          label={`用 WhatsApp 聯絡 ${appointment.customerName}`}
          onPress={() => void openWhatsApp(phone, reminderMessage(appointment))}
        />
      ) : null}
    </HStack>
  );

  if (!menu) return content;
  return (
    <ContextMenu modifiers={[ownRowInsets]}>
      <ContextMenu.Items>
        {!inCustomerHistory ? (
          <Button
            label="顧客資料"
            systemImage="person.crop.circle"
            onPress={() => openAppointmentCustomer(appointment)}
          />
        ) : null}
        <Button
          label={noShowLabel(appointment)}
          systemImage={
            appointment.status === NO_SHOW ? 'arrow.uturn.backward' : 'person.crop.circle.badge.xmark'
          }
          onPress={() => toggleNoShow(appointment)}
        />
      </ContextMenu.Items>
      <ContextMenu.Trigger>{content}</ContextMenu.Trigger>
    </ContextMenu>
  );
});

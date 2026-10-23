/**
 * Native list row for an appointment — tap opens details; WhatsApp button
 * when there's a phone, unless `showWhatsApp` is false.
 */
import {
  Button,
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
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';

import { serviceColor } from '@/constants/services';
import type { Appointment } from '@/types/appointment';
import { openAppointmentDetails } from '@/utils/appointmentActions';
import { appointmentTitle } from '@/utils/appointmentTitle';
import { openWhatsApp, reminderMessage } from '@/utils/whatsapp';

import { WhatsAppButton } from './WhatsAppButton';

type Props = {
  appointment: Appointment;
  showWhatsApp?: boolean;
};

export function AppointmentRow({ appointment, showWhatsApp = true }: Props) {
  const phone = showWhatsApp ? appointment.phone?.trim() : undefined;
  const title = appointmentTitle(appointment);
  const hasEnd = Boolean(appointment.endTime && appointment.endTime !== appointment.time);
  const color = serviceColor(appointment.service);
  const meta = [
    appointment.service.includes('甲') ? appointment.handOrFoot : null,
    appointment.price ? `$${appointment.price}` : null,
    appointment.status === '已完成' ? '已完成' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <HStack spacing={8}>
      <Button
        onPress={() => openAppointmentDetails(appointment)}
        modifiers={[buttonStyle('plain'), padding({ vertical: 4 })]}
      >
        {/* contentShape + Spacer make the whole row tappable, not only the text */}
        <HStack spacing={10} modifiers={[contentShape(shapes.rectangle())]}>
          <VStack spacing={2} alignment="leading" modifiers={[padding({ trailing: 4 })]}>
            <Text modifiers={[font({ size: 16, weight: 'bold' })]}>{appointment.time}</Text>
            {hasEnd ? (
              <Text
                modifiers={[
                  font({ size: 13 }),
                  foregroundStyle({ type: 'hierarchical', style: 'tertiary' }),
                ]}
              >
                {appointment.endTime}
              </Text>
            ) : null}
          </VStack>

          <VStack spacing={3} alignment="leading">
            <Text modifiers={[font({ size: 17, weight: 'semibold' })]}>{title}</Text>
            <HStack spacing={4}>
              <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(color)]}>
                {appointment.service}
              </Text>
              {meta ? (
                <Text
                  modifiers={[
                    font({ size: 14 }),
                    foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                  ]}
                >
                  · {meta}
                </Text>
              ) : null}
            </HStack>
            {appointment.notes && appointment.notes !== title ? (
              <Text
                modifiers={[
                  font({ size: 13 }),
                  foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                ]}
              >
                {appointment.notes}
              </Text>
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
}

/**
 * One appointment in the Day / Week grid (iOS), drawn in SwiftUI so a long
 * press opens a native context menu with 顧客資料 and No show (customer
 * bookings only), 保留訂金 (when 訂金 was paid), 修改 and 刪除. A tap still opens the
 * details, and 刪除 asks first with a confirmationDialog, as the details do.
 */
import {
  Button,
  ConfirmationDialog,
  ContextMenu,
  HStack,
  Host,
  Rectangle,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  background,
  clipShape,
  contentShape,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  onTapGesture,
  opacity,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { router } from 'expo-router';
import { useState } from 'react';

import { serviceColor } from '@/constants/services';
import { colors, radius, tint } from '@/constants/theme';
import { removeAppointment, saveKeepDeposit } from '@/hooks/appointmentWrites';
import { NO_SHOW } from '@/types/appointment';
import {
  canKeepDeposit,
  hasCustomerActions,
  keepDepositPrompt,
  noShowLabel,
  openAppointmentCustomer,
  toggleNoShow,
} from '@/utils/appointmentActions';
import { appointmentTitle } from '@/utils/appointmentTitle';
import { formatDateHeader } from '@/utils/groupByDate';

import type { TimeGridBlockProps } from './TimeGridBlock';

export function TimeGridBlock({ appointment: apt, frame: position, compact, lanes, onPress }: TimeGridBlockProps) {
  const [confirming, setConfirming] = useState(false);
  const color = serviceColor(apt.service);
  const title = appointmentTitle(apt);
  // Too short for two lines (e.g. 30 min): name and time on one
  const short = position.height < 44;
  const timeRange = apt.endTime && apt.endTime !== apt.time ? `${apt.time}–${apt.endTime}` : apt.time;
  const shape = shapes.roundedRectangle({ cornerRadius: radius.xs });
  const noShow = apt.status === NO_SHOW;

  return (
    <Host colorScheme="dark" seedColor={colors.accent} style={[{ position: 'absolute' }, position]}>
      <ConfirmationDialog
        title="刪除預約？"
        titleVisibility="visible"
        isPresented={confirming}
        onIsPresentedChange={setConfirming}
      >
        <ConfirmationDialog.Trigger>
          <ContextMenu>
            <ContextMenu.Items>
              {hasCustomerActions(apt) ? (
                <>
                  <Button
                    label="顧客資料"
                    systemImage="person.crop.circle"
                    onPress={() => openAppointmentCustomer(apt)}
                  />
                  <Button
                    label={noShowLabel(apt)}
                    systemImage={noShow ? 'arrow.uturn.backward' : 'person.crop.circle.badge.xmark'}
                    onPress={() => toggleNoShow(apt)}
                  />
                </>
              ) : null}
              {canKeepDeposit(apt) ? (
                // Saved at once, like No show; the same item then undoes it
                <Button
                  label={keepDepositPrompt(apt).label}
                  systemImage={apt.keepDeposit ? 'arrow.uturn.backward' : 'banknote'}
                  onPress={() => saveKeepDeposit(apt, !apt.keepDeposit)}
                />
              ) : null}
              <Button
                label="修改"
                systemImage="pencil"
                onPress={() =>
                  router.push({ pathname: '/add-appointment', params: { id: apt.id } })
                }
              />
              <Button
                label="刪除"
                systemImage="trash"
                role="destructive"
                onPress={() => setConfirming(true)}
              />
            </ContextMenu.Items>
            <ContextMenu.Trigger>
              <HStack
                spacing={0}
                alignment="top"
                modifiers={[
                  frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
                  background(tint(color, 0.3)),
                  clipShape('roundedRectangle', radius.xs),
                  // Gap between neighbouring blocks
                  padding({ trailing: 1, bottom: 1 }),
                  // No show bookings stay in place, faded
                  opacity(noShow ? 0.45 : 1),
                  contentShape(shape),
                  onTapGesture(() => onPress(apt)),
                  accessibilityLabel(`${apt.time} ${title} ${apt.service}${noShow ? ' No show' : ''}`),
                ]}
              >
                <Rectangle modifiers={[frame({ width: 3 }), foregroundStyle(color)]} />
                <VStack
                  alignment="leading"
                  spacing={1}
                  modifiers={[
                    padding({ leading: 5, trailing: 5, top: 3, bottom: 3 }),
                    frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
                  ]}
                >
                  {compact ? (
                    // Narrow lanes get one truncated line rather than wrapping per letter
                    <Text
                      modifiers={[
                        font({ size: 10, weight: 'semibold' }),
                        foregroundStyle(colors.text),
                        lineLimit(lanes > 1 ? 1 : 3),
                      ]}
                    >
                      {title}
                    </Text>
                  ) : short ? (
                    <Text
                      modifiers={[
                        font({ size: 14, weight: 'bold' }),
                        foregroundStyle(colors.text),
                        lineLimit(1),
                      ]}
                    >
                      {`${title}  ${apt.time} · ${apt.service}`}
                    </Text>
                  ) : (
                    <>
                      <Text
                        modifiers={[
                          font({ size: 14, weight: 'bold' }),
                          foregroundStyle(colors.text),
                          lineLimit(1),
                        ]}
                      >
                        {title}
                      </Text>
                      <Text
                        modifiers={[
                          font({ size: 12 }),
                          monospacedDigit(),
                          foregroundStyle(colors.textSecondary),
                          lineLimit(1),
                        ]}
                      >
                        {[timeRange, apt.service, apt.notes && apt.notes !== title ? apt.notes : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </>
                  )}
                </VStack>
              </HStack>
            </ContextMenu.Trigger>
          </ContextMenu>
        </ConfirmationDialog.Trigger>
        <ConfirmationDialog.Actions>
          <Button
            label="刪除"
            role="destructive"
            onPress={() => {
              setConfirming(false);
              // Disappears at once and is sent in the background; a failure brings it back
              removeAppointment(apt);
            }}
          />
          <Button label="取消" role="cancel" onPress={() => setConfirming(false)} />
        </ConfirmationDialog.Actions>
        <ConfirmationDialog.Message>
          <Text>{`${title} ${formatDateHeader(apt.date)} ${apt.time}\n刪除後無法復原。`}</Text>
        </ConfirmationDialog.Message>
      </ConfirmationDialog>
    </Host>
  );
}

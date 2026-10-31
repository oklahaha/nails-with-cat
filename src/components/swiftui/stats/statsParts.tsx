/** Small pieces shared by the 統計 tabs on iOS. */
import { Button, HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  animation,
  Animation,
  buttonStyle,
  contentShape,
  contentTransition,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  shapes,
} from '@expo/ui/swift-ui/modifiers';

import { WhatsAppButton } from '@/components/swiftui/WhatsAppButton';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import type { CustomerStats } from '@/utils/stats';
import { openWhatsApp } from '@/utils/whatsapp';

/** The accent at ~35% over the dark row background, for bars that aren't highlighted. */
export const ACCENT_FADED = '#674642';

export const SECONDARY = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

/** YYYY-MM-DD → 9月3日 */
export function formatDay(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return m && d ? `${m}月${d}日` : iso;
}

/**
 * A number with its label, for a row of up to three. Give it `rollOn` to have
 * the number roll to its new value whenever that changes.
 */
export function Stat({
  label,
  value,
  rollOn,
}: {
  label: string;
  value: string | number;
  rollOn?: number;
}) {
  const reduceMotion = useReduceMotion();
  const roll =
    rollOn != null && !reduceMotion
      ? [contentTransition('numericText'), animation(Animation.smooth({ duration: 0.25 }), rollOn)]
      : [];
  return (
    <VStack spacing={2} alignment="leading" modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      <Text modifiers={[font({ size: 12 }), SECONDARY]}>{label}</Text>
      <Text modifiers={[font({ size: 20, weight: 'semibold' }), monospacedDigit(), lineLimit(1), ...roll]}>
        {value}
      </Text>
    </VStack>
  );
}

export function EmptyRow({ children }: { children: string }) {
  return <Text modifiers={[SECONDARY]}>{children}</Text>;
}

export function CustomerStatRow({
  customer,
  rank,
  detail,
  value,
  onPress,
  showWhatsApp,
}: {
  customer: Pick<CustomerStats, 'name' | 'phone'>;
  rank?: number;
  detail: string;
  value: string;
  onPress: () => void;
  showWhatsApp?: boolean;
}) {
  return (
    <HStack spacing={8}>
      <Button onPress={onPress} modifiers={[buttonStyle('plain')]}>
        <HStack spacing={8} modifiers={[contentShape(shapes.rectangle())]}>
          {rank != null ? <Text modifiers={[font({ size: 13 }), SECONDARY]}>{rank}</Text> : null}
          <VStack spacing={2} alignment="leading">
            <Text modifiers={[font({ weight: 'semibold' })]}>{customer.name}</Text>
            <Text modifiers={[font({ size: 12 }), SECONDARY]}>{detail}</Text>
          </VStack>
          <Spacer />
          <Text modifiers={[font({ weight: 'semibold' }), monospacedDigit()]}>{value}</Text>
        </HStack>
      </Button>
      {showWhatsApp && customer.phone ? (
        <WhatsAppButton
          label={`用 WhatsApp 聯絡 ${customer.name}`}
          onPress={() => void openWhatsApp(customer.phone!)}
        />
      ) : null}
    </HStack>
  );
}

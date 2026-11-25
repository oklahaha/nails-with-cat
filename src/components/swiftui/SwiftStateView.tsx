/**
 * Loading / error / empty states: pulsing redacted placeholder rows while loading, ContentUnavailableView otherwise.
 * SwiftStateContent goes inside a screen's existing Host.
 */
import { Button, ContentUnavailableView, HStack, Image, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  animation,
  Animation,
  font,
  foregroundStyle,
  frame,
  opacity,
  padding,
  redacted,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useState } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useReduceMotion } from '@/hooks/useReduceMotion';

import { SwiftHost } from './SwiftHost';

type Props = {
  loading?: boolean;
  title: string;
  message?: string;
  systemImage?: SFSymbol;
  action?: { label: string; onPress: () => void };
};

export function SwiftStateView(props: Props) {
  return (
    <SwiftHost>
      <SwiftStateContent {...props} />
    </SwiftHost>
  );
}

export function SwiftStateContent({
  loading,
  title,
  message,
  systemImage = 'calendar',
  action,
}: Props) {
  if (loading) return <Skeleton title={title} systemImage={systemImage} />;

  return (
    <VStack spacing={16} modifiers={[padding({ all: 24 })]} alignment="center">
      <ContentUnavailableView title={title} systemImage={systemImage} description={message} />
      {action ? <Button label={action.label} onPress={action.onPress} /> : null}
    </VStack>
  );
}

const SKELETON_ROWS = 6;

/** Grey placeholder rows that gently pulse while a screen first loads. */
function Skeleton({ title, systemImage }: { title: string; systemImage: SFSymbol }) {
  const reduceMotion = useReduceMotion();
  const [dim, setDim] = useState(false);
  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(() => setDim((d) => !d), 900);
    return () => clearInterval(timer);
  }, [reduceMotion]);

  return (
    <VStack
      spacing={20}
      alignment="leading"
      modifiers={[
        padding({ all: 20 }),
        frame({
          maxWidth: Infinity,
          maxHeight: Infinity,
          alignment: 'topLeading',
        }),
      ]}
    >
      <Text
        modifiers={[font({ size: 15 }), foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}
      >
        {title}
      </Text>
      <VStack
        spacing={20}
        alignment="leading"
        modifiers={[
          redacted('placeholder'),
          opacity(dim ? 0.45 : 1),
          // Each fade stays under 300 ms; the pause between them sets the pace
          animation(Animation.easeInOut({ duration: 0.28 }), dim),
          // VoiceOver reads the title above, not the placeholder text
          accessibilityHidden(true),
        ]}
      >
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <HStack key={i} spacing={12}>
            <Image systemName={systemImage} size={28} />
            <VStack spacing={6} alignment="leading">
              <Text modifiers={[font({ size: 17 })]}>顧客姓名 整甲</Text>
              <Text modifiers={[font({ size: 14 })]}>
                {i % 2 ? '2026年11月25日 14:00' : '星期三 10:00 – 12:00 整甲'}
              </Text>
            </VStack>
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
}

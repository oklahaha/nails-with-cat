/**
 * Error / empty states as a ContentUnavailableView (first loads use SwiftSkeleton).
 * SwiftStateContent goes inside a screen's existing Host.
 */
import { Button, ContentUnavailableView, VStack } from '@expo/ui/swift-ui';
import { padding } from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import { SwiftHost } from './SwiftHost';

type Props = {
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
  title,
  message,
  systemImage = 'calendar',
  action,
}: Props) {
  return (
    <VStack spacing={16} modifiers={[padding({ all: 24 })]} alignment="center">
      <ContentUnavailableView title={title} systemImage={systemImage} description={message} />
      {action ? <Button label={action.label} onPress={action.onPress} /> : null}
    </VStack>
  );
}

/**
 * Loading / error / empty states using native SwiftUI ProgressView + ContentUnavailableView.
 */
import {
  Button,
  ContentUnavailableView,
  ProgressView,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, padding } from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import { SwiftHost } from './SwiftHost';

type Props = {
  loading?: boolean;
  title: string;
  message?: string;
  systemImage?: SFSymbol;
  action?: { label: string; onPress: () => void };
};

export function SwiftStateView({
  loading,
  title,
  message,
  systemImage = 'calendar',
  action,
}: Props) {
  if (loading) {
    return (
      <SwiftHost>
        <VStack
          spacing={12}
          modifiers={[padding({ all: 24 }), frame({ maxWidth: Infinity, maxHeight: Infinity })]}
          alignment="center"
        >
          <ProgressView />
          <Text
            modifiers={[
              font({ size: 15 }),
              foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
            ]}
          >
            {title}
          </Text>
        </VStack>
      </SwiftHost>
    );
  }

  return (
    <SwiftHost>
      <VStack spacing={16} modifiers={[padding({ all: 24 })]} alignment="center">
        <ContentUnavailableView title={title} systemImage={systemImage} description={message} />
        {action ? (
          <Button label={action.label} onPress={action.onPress} />
        ) : null}
      </VStack>
    </SwiftHost>
  );
}

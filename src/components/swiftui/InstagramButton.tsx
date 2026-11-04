/**
 * Instagram button with the logo and the @name (SwiftUI). Like
 * WhatsAppButton, the logo is a bundled PNG (assets/images/instagram.png,
 * white on transparent), since SF Symbols has none, read through expo-asset.
 */
import { Button, HStack, Image, Text } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  foregroundStyle,
  frame,
  resizable,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useAssets } from 'expo-asset';

import { colors } from '@/constants/theme';

import { glassProminentButton } from './glass';

const LOGO = require('../../../assets/images/instagram.png');

type Props = {
  /** Profile name, shown as @handle. */
  handle: string;
  onPress: () => void;
};

export function InstagramButton({ handle, onPress }: Props) {
  const [assets] = useAssets([LOGO]);
  const uri = assets?.[0]?.localUri;

  return (
    <Button
      onPress={onPress}
      modifiers={[
        glassProminentButton(),
        tint(colors.accent),
        accessibilityLabel(`開啟 Instagram：${handle}`),
      ]}
    >
      <HStack spacing={6}>
        {/* The logo appears once its file is ready; the name shows at once */}
        {uri ? (
          <Image uiImage={uri} modifiers={[resizable(), frame({ width: 16, height: 16 })]} />
        ) : null}
        <Text modifiers={[foregroundStyle('#FFFFFF')]}>@{handle}</Text>
      </HStack>
    </Button>
  );
}

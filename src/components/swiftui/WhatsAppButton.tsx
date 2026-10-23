/**
 * Round WhatsApp button with the WhatsApp logo and no text (SwiftUI).
 * SF Symbols has no WhatsApp logo, so the glyph is a bundled PNG
 * (assets/images/whatsapp.png, white on transparent), which SwiftUI's Image
 * can only read from a local file — expo-asset provides that file URI.
 */
import { Button, Image } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonBorderShape,
  frame,
  resizable,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useAssets } from 'expo-asset';

import { colors } from '@/constants/theme';

import { glassProminentButton } from './glass';

const LOGO = require('../../../assets/images/whatsapp.png');

type Props = {
  onPress: () => void;
  /** Read by VoiceOver, since the button has no text. */
  label?: string;
};

export function WhatsAppButton({ onPress, label = 'WhatsApp' }: Props) {
  const [assets] = useAssets([LOGO]);
  const uri = assets?.[0]?.localUri;

  return (
    <Button
      onPress={onPress}
      modifiers={[
        glassProminentButton(),
        buttonBorderShape('circle'),
        tint(colors.whatsapp),
        accessibilityLabel(label),
      ]}
    >
      {uri ? (
        <Image uiImage={uri} modifiers={[resizable(), frame({ width: 20, height: 20 })]} />
      ) : (
        // Shown for the moment before the logo file is ready
        <Image systemName="phone.fill" size={16} color="#FFFFFF" />
      )}
    </Button>
  );
}

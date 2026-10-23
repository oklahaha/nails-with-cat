import { Image } from 'react-native';

/** The WhatsApp logo (white, on transparent) for the green WhatsApp buttons. */
const LOGO = require('../../assets/images/whatsapp.png');

export function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return <Image source={LOGO} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />;
}

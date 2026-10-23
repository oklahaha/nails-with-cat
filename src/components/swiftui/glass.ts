/**
 * Liquid Glass button styles. `glass` / `glassProminent` only exist on iOS 26+;
 * @expo/ui falls back to the plain `automatic` style below that, so older
 * iOS keeps the bordered look instead.
 */
import { buttonStyle } from '@expo/ui/swift-ui/modifiers';
import { Platform } from 'react-native';

export const LIQUID_GLASS =
  Platform.OS === 'ios' && Number.parseInt(String(Platform.Version), 10) >= 26;

export const glassButton = () => buttonStyle(LIQUID_GLASS ? 'glass' : 'bordered');

export const glassProminentButton = () =>
  buttonStyle(LIQUID_GLASS ? 'glassProminent' : 'borderedProminent');

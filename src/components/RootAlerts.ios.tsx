/**
 * Presents showAlert's alerts while no modal is open. Mounted once, in the
 * root layout; its Host is an invisible point, since an alert draws itself in
 * the middle of the screen.
 */
import { Host } from '@expo/ui/swift-ui';
import { StyleSheet } from 'react-native';

import { colors } from '@/constants/theme';

import { AlertPresenter } from './swiftui/AlertPresenter';

export function RootAlerts() {
  return (
    <Host colorScheme="dark" seedColor={colors.accent} style={styles.host}>
      <AlertPresenter />
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    width: 1,
    height: 1,
  },
});

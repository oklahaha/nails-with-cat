/**
 * Floating add button rendered as a SwiftUI Host overlay (matchContents).
 * The native tab bar floats over the screen, so the bottom safe area
 * (which includes the bar) keeps the button above it.
 */
import { Button, Host } from '@expo/ui/swift-ui';
import {
  buttonBorderShape,
  controlSize,
  labelStyle,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/constants/theme';

import { glassProminentButton } from './glass';

type Props = {
  date?: string;
  onPress?: () => void;
  label?: string;
};

export function SwiftFab({ date, onPress, label = '新增預約' }: Props) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.wrap}>
      <View style={styles.inner}>
        <Host matchContents colorScheme="dark" seedColor={colors.accent}>
          <Button
            label={label}
            systemImage="plus"
            onPress={
              onPress ??
              (() =>
                router.push({
                  pathname: '/add-appointment',
                  params: date ? { date } : {},
                }))
            }
            modifiers={[
              glassProminentButton(),
              controlSize('large'),
              labelStyle('iconOnly'),
              buttonBorderShape('circle'),
              tint(colors.accent),
            ]}
          />
        </Host>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 0,
    bottom: 0,
  },
  inner: {
    padding: spacing.md,
  },
});

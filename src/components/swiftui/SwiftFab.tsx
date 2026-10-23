/**
 * Floating add button rendered as a SwiftUI Host overlay (matchContents).
 */
import { Button, Host } from '@expo/ui/swift-ui';
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  labelStyle,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/constants/theme';

type Props = {
  date?: string;
  onPress?: () => void;
  label?: string;
};

export function SwiftFab({ date, onPress, label = '新增預約' }: Props) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
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
            buttonStyle('borderedProminent'),
            controlSize('large'),
            labelStyle('iconOnly'),
            buttonBorderShape('circle'),
            tint(colors.accent),
          ]}
        />
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
  },
});

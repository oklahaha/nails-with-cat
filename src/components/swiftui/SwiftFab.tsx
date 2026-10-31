/**
 * Floating add button. Put it last in a ZStack with bottomTrailing alignment:
 * the bottom safe area, which includes the floating tab bar, keeps it above
 * the bar. It stays put when the keyboard opens.
 */
import { Button } from '@expo/ui/swift-ui';
import {
  buttonBorderShape,
  controlSize,
  ignoreSafeArea,
  labelStyle,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { router } from 'expo-router';

import { colors, spacing } from '@/constants/theme';

import { glassProminentButton } from './glass';

type Props = {
  date?: string;
  onPress?: () => void;
  label?: string;
};

export function SwiftFab({ date, onPress, label = '新增預約' }: Props) {
  return (
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
        padding({ all: spacing.md }),
        ignoreSafeArea({ regions: 'keyboard' }),
      ]}
    />
  );
}

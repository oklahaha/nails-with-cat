import { Platform } from 'react-native';

import { colors } from './theme';

/** Header and background options shared by the root stack and the stacks nested in modals. */
export const stackScreenOptions = {
  // On iOS the modal headers keep the system look: Liquid Glass buttons over the sheet
  headerStyle: Platform.OS === 'ios' ? undefined : { backgroundColor: colors.background },
  headerShadowVisible: false,
  headerTintColor: colors.accent,
  headerTitleStyle: { color: colors.text, fontWeight: '600' as const },
  contentStyle: { backgroundColor: colors.background },
};

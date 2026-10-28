import { useNavigation } from 'expo-router';
import { useEffect, useEffectEvent } from 'react';

/**
 * Calls `onReselect` when the user taps this screen's tab while already on it
 * (e.g. 時間表 → back to the month). Works with both the iOS NativeTabs and
 * the JS Tabs, which emit `tabPress` before switching, so a press that
 * arrives while the screen isn't focused is a switch from another tab.
 */
export function useTabReselect(onReselect: () => void) {
  const navigation = useNavigation();
  const handle = useEffectEvent(onReselect);
  useEffect(
    () =>
      // `tabPress` isn't in the generic navigation's event map
      navigation.addListener('tabPress' as never, () => {
        if (navigation.isFocused()) handle();
      }),
    [navigation],
  );
}

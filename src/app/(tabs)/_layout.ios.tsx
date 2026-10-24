/**
 * Bottom tabs (iOS) — the native UITabBar via NativeTabs, which draws the
 * Liquid Glass bar on iOS 26+: 統計 · 顧客資料 · 預約資料 · 時間表 (home).
 * New bookings start from the ＋ buttons.
 *
 * Native tabs have no headers, so each iOS screen draws its own title
 * (a SwiftUI NavigationStack, or the timetable's own top bar).
 *
 * The bar hides while scrolling down and returns on scroll up
 * (useHideTabBarOnScroll in each screen). iOS animates that itself.
 */
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { colors } from '@/constants/theme';
import { TabBarVisibilityProvider, useTabBarHidden } from '@/hooks/useTabBarVisibility';

export default function TabLayout() {
  return (
    <TabBarVisibilityProvider>
      <Tabs />
    </TabBarVisibilityProvider>
  );
}

function Tabs() {
  const hidden = useTabBarHidden();
  return (
    <NativeTabs tintColor={colors.accent} minimizeBehavior="never" hidden={hidden}>
      <NativeTabs.Trigger name="stats">
        <NativeTabs.Trigger.Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} />
        <NativeTabs.Trigger.Label>統計</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="customers">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.text.rectangle', selected: 'person.text.rectangle.fill' }}
        />
        <NativeTabs.Trigger.Label>顧客資料</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="appointments">
        <NativeTabs.Trigger.Icon sf="list.bullet" />
        <NativeTabs.Trigger.Label>預約資料</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="calendar" />
        <NativeTabs.Trigger.Label>時間表</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

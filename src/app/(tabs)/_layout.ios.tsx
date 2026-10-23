/**
 * Bottom tabs (iOS) — the native UITabBar via NativeTabs, which draws the
 * Liquid Glass bar on iOS 26+: 統計 · 顧客資料 · 預約資料 · 時間表 (home).
 * New bookings start from the ＋ buttons.
 *
 * Native tabs have no headers, so each iOS screen draws its own title
 * (a SwiftUI NavigationStack, or the timetable's own top bar).
 */
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { colors } from '@/constants/theme';

export default function TabLayout() {
  return (
    <NativeTabs tintColor={colors.accent} minimizeBehavior="onScrollDown">
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

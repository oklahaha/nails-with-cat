/**
 * Bottom tabs (Android, web; iOS uses _layout.ios.tsx), in the same order as iOS:
 * 統計 · 顧客資料 · 預約資料 · 時間表 (home). New bookings start from the ＋ buttons.
 */
import { Tabs } from 'expo-router';

import { Icon } from '@/components/Icon';
import { colors } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.text, fontWeight: '700', fontSize: 18 },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="stats"
        options={{
          title: '統計',
          tabBarIcon: ({ color }) => <Icon name="chart" color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: '顧客資料',
          tabBarIcon: ({ color }) => <Icon name="customers" color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: '預約資料',
          tabBarIcon: ({ color }) => <Icon name="list" color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: '時間表',
          headerShown: false,
          tabBarIcon: ({ color }) => <Icon name="calendar" color={color} size={22} />,
        }}
      />
    </Tabs>
  );
}

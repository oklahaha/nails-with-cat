import { router, Stack } from 'expo-router';

import { SwiftStateView } from '@/components/swiftui/SwiftStateView';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: '找不到頁面' }} />
      <SwiftStateView
        title="此頁面不存在"
        systemImage="questionmark.circle"
        action={{ label: '回到時間表', onPress: () => router.replace('/') }}
      />
    </>
  );
}

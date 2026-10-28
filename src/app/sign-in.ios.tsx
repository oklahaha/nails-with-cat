/**
 * Sign in — SwiftUI. Shown instead of the app until an allowed Google
 * account signs in (see the root layout's Stack.Protected).
 */
import { Button, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  controlSize,
  disabled,
  font,
  foregroundStyle,
  frame,
  multilineTextAlignment,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { GOOGLE_SIGN_IN_CONFIGURED, useGoogleSignIn } from '@/auth/useGoogleSignIn';
import { glassProminentButton } from '@/components/swiftui/glass';
import { SwiftHost } from '@/components/swiftui/SwiftHost';
import { SwiftStateView } from '@/components/swiftui/SwiftStateView';
import { colors } from '@/constants/theme';

export default function SignInScreen() {
  if (!GOOGLE_SIGN_IN_CONFIGURED) {
    return (
      <SwiftStateView
        title="未設定 Google 登入"
        message="請在 .env.local 加入 EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID"
        systemImage="person.crop.circle.badge.exclamationmark"
      />
    );
  }
  return <SignIn />;
}

function SignIn() {
  const { ready, busy, start } = useGoogleSignIn();

  return (
    <SwiftHost>
      <VStack
        spacing={16}
        alignment="center"
        modifiers={[padding({ all: 32 }), frame({ maxWidth: Infinity, maxHeight: Infinity })]}
      >
        <Spacer />
        <Image systemName="calendar.badge.clock" size={64} color={colors.accent} />
        <Text modifiers={[font({ size: 28, weight: 'bold' })]}>預約時間表</Text>
        <Text
          modifiers={[
            font({ size: 15 }),
            foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
            multilineTextAlignment('center'),
          ]}
        >
          請用已登記的 Google 帳戶登入
        </Text>
        <Spacer />
        {busy ? (
          <ProgressView />
        ) : (
          <Button
            label="使用 Google 登入"
            systemImage="person.crop.circle"
            onPress={start}
            modifiers={[
              glassProminentButton(),
              controlSize('large'),
              tint(colors.accent),
              disabled(!ready),
            ]}
          />
        )}
      </VStack>
    </SwiftHost>
  );
}

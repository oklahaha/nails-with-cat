/**
 * Asks whether to WhatsApp a confirmation for a booking just added (see
 * whatsAppConfirmation), with a SwiftUI alert. Mounted once, in the root
 * layout, so it shows after the form has closed; its Host is an invisible
 * point, since the alert draws itself in the middle of the screen.
 */
import { Alert, Button, Host, Text } from '@expo/ui/swift-ui';
import { StyleSheet } from 'react-native';

import { colors } from '@/constants/theme';
import { answerWhatsAppConfirmation, useWhatsAppConfirmation } from '@/hooks/whatsAppConfirmation';

import { confirmationQuestion } from './whatsAppConfirmationText';

export function WhatsAppConfirmationDialog() {
  const current = useWhatsAppConfirmation();
  const answer = (send: boolean) => {
    if (current) answerWhatsAppConfirmation(current, send);
  };
  return (
    <Host colorScheme="dark" seedColor={colors.accent} style={styles.host}>
      <Alert
        title={confirmationQuestion.title}
        isPresented={current != null}
        onIsPresentedChange={(presented) => {
          if (!presented) answer(false);
        }}
      >
        <Alert.Trigger>
          <Text> </Text>
        </Alert.Trigger>
        <Alert.Actions>
          <Button label="稍後" role="cancel" onPress={() => answer(false)} />
          <Button label="發送確認訊息" onPress={() => answer(true)} />
        </Alert.Actions>
        <Alert.Message>
          <Text>{current ? confirmationQuestion.message(current) : ''}</Text>
        </Alert.Message>
      </Alert>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    width: 1,
    height: 1,
  },
});

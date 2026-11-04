/**
 * 保留訂金 row for the iOS appointment details: a SwiftUI button that asks
 * with a SwiftUI alert, then marks the booking as keeping its deposit for
 * the customer's next booking (or, once marked, 取消保留訂金 undoes it).
 */
import { Alert, Button, Text } from '@expo/ui/swift-ui';
import { useState } from 'react';

import { saveKeepDeposit } from '@/hooks/appointmentWrites';
import type { Appointment } from '@/types/appointment';
import { keepDepositPrompt } from '@/utils/appointmentActions';

type Props = {
  appointment: Appointment;
  onDone: (saved: Appointment) => void;
};

export function KeepDepositButton({ appointment, onDone }: Props) {
  const [presented, setPresented] = useState(false);
  const prompt = keepDepositPrompt(appointment);

  return (
    <Alert title={prompt.title} isPresented={presented} onIsPresentedChange={setPresented}>
      <Alert.Trigger>
        <Button
          label={prompt.label}
          systemImage={prompt.keep ? 'banknote' : 'arrow.uturn.backward'}
          role={prompt.keep ? undefined : 'destructive'}
          onPress={() => setPresented(true)}
        />
      </Alert.Trigger>
      <Alert.Actions>
        <Button label="取消" role="cancel" onPress={() => setPresented(false)} />
        <Button
          label={prompt.confirm}
          onPress={() => {
            setPresented(false);
            onDone(saveKeepDeposit(appointment, prompt.keep));
          }}
        />
      </Alert.Actions>
      <Alert.Message>
        <Text>{prompt.message}</Text>
      </Alert.Message>
    </Alert>
  );
}

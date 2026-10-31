/**
 * Shows showAlert's alerts as SwiftUI alerts. Goes inside a Host, behind the
 * screen's content: one in the root layout (RootAlerts), one in each modal
 * (SwiftModal). Only the newest one mounted presents; see alertQueue.
 */
import { Alert, Button, Text } from '@expo/ui/swift-ui';
import { useEffect, useState, useSyncExternalStore } from 'react';

import {
  addAlertPresenter,
  answerAlert,
  currentAlert,
  frontPresenter,
  subscribeAlerts,
  type QueuedAlert,
} from '@/utils/alertQueue';

/** Long enough for a closing alert or sheet to finish, since iOS can't present during that. */
const PRESENT_AFTER_MS = 300;

export function AlertPresenter() {
  const [presenter] = useState(() => ({}));
  useEffect(() => addAlertPresenter(presenter), [presenter]);
  const alert = useSyncExternalStore(subscribeAlerts, currentAlert);
  const inFront = useSyncExternalStore(subscribeAlerts, () => frontPresenter() === presenter);
  return alert && inFront ? <PresentedAlert key={alert.id} alert={alert} /> : null;
}

function PresentedAlert({ alert }: { alert: QueuedAlert }) {
  const [presented, setPresented] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setPresented(true), PRESENT_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  // A SwiftUI alert only closes through its buttons, each of which answers it
  return (
    <Alert title={alert.title} isPresented={presented}>
      <Alert.Trigger>
        <Text> </Text>
      </Alert.Trigger>
      <Alert.Actions>
        {alert.buttons.map((button, i) => (
          <Button
            key={i}
            label={button.text ?? '確定'}
            role={
              button.style === 'cancel' || button.style === 'destructive' ? button.style : undefined
            }
            onPress={() => answerAlert(alert, button)}
          />
        ))}
      </Alert.Actions>
      {alert.message ? (
        <Alert.Message>
          <Text>{alert.message}</Text>
        </Alert.Message>
      ) : null}
    </Alert>
  );
}

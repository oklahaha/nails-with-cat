/**
 * The red full-width delete row at the bottom of an edit form, which asks
 * first with a native SwiftUI confirmationDialog (an action sheet) and calls
 * `onConfirm` only after 刪除 is tapped there.
 */
import { Button, ConfirmationDialog, Text } from '@expo/ui/swift-ui';
import { useState } from 'react';

type Props = {
  label: string;
  title: string;
  message: string;
  onConfirm: () => void;
};

export function DeleteConfirmButton({ label, title, message, onConfirm }: Props) {
  const [presented, setPresented] = useState(false);

  return (
    <ConfirmationDialog
      title={title}
      titleVisibility="visible"
      isPresented={presented}
      onIsPresentedChange={setPresented}
    >
      <ConfirmationDialog.Trigger>
        <Button
          label={label}
          role="destructive"
          onPress={() => setPresented(true)}
        />
      </ConfirmationDialog.Trigger>
      <ConfirmationDialog.Actions>
        <Button
          label="刪除"
          role="destructive"
          onPress={() => {
            setPresented(false);
            onConfirm();
          }}
        />
        <Button label="取消" role="cancel" onPress={() => setPresented(false)} />
      </ConfirmationDialog.Actions>
      <ConfirmationDialog.Message>
        <Text>{message}</Text>
      </ConfirmationDialog.Message>
    </ConfirmationDialog>
  );
}

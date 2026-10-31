/**
 * Shell for the iOS modals: the SwiftUI content under the native stack
 * header (title from the root layout), with a close button as a native bar
 * button item (left out without `onClose`, e.g. on a screen pushed inside a
 * sheet, which shows the back button instead), and on the right either a ✓ save button (the modal's only
 * save button) or a 修改 text button, all drawn by iOS 26 in Liquid Glass.
 * The ✓ uses the `done` style, which iOS 26 fills with the header tint (the
 * accent).
 *
 * A SwiftUI NavigationStack + Toolbar bar doesn't show inside these
 * native-stack modals, so the header stays on the UIKit side.
 */
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';

import { AlertPresenter } from './AlertPresenter';
import { SwiftHost } from './SwiftHost';

type Props = {
  onClose?: () => void;
  /** Shows the ✓ button. */
  onSave?: () => void;
  saveDisabled?: boolean;
  /** Shows the 修改 button (when there's no `onSave`). */
  onEdit?: () => void;
  children: ReactNode;
};

export function SwiftModal({ onClose, onSave, saveDisabled, onEdit, children }: Props) {
  return (
    <>
      <SwiftHost>
        <AlertPresenter />
        {children}
      </SwiftHost>
      {onClose ? (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button icon="xmark" accessibilityLabel="關閉" onPress={onClose} />
        </Stack.Toolbar>
      ) : null}
      {onSave ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon="checkmark"
            accessibilityLabel="儲存"
            variant="done"
            disabled={saveDisabled}
            onPress={onSave}
          />
        </Stack.Toolbar>
      ) : onEdit ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button onPress={onEdit}>修改</Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
    </>
  );
}

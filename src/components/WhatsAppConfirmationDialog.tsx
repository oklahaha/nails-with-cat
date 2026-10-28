/**
 * Asks whether to WhatsApp a confirmation for a booking just added (see
 * whatsAppConfirmation). Android and web use showAlert; iOS has a SwiftUI
 * alert. Mounted once, in the root layout.
 */
import { useEffect } from 'react';

import { answerWhatsAppConfirmation, useWhatsAppConfirmation } from '@/hooks/whatsAppConfirmation';
import { showAlert } from '@/utils/alert';

import { confirmationQuestion } from './whatsAppConfirmationText';

export function WhatsAppConfirmationDialog() {
  const current = useWhatsAppConfirmation();
  useEffect(() => {
    if (!current) return;
    showAlert(confirmationQuestion.title, confirmationQuestion.message(current), [
      { text: '稍後', style: 'cancel', onPress: () => answerWhatsAppConfirmation(current, false) },
      { text: '發送確認訊息', onPress: () => answerWhatsAppConfirmation(current, true) },
    ]);
  }, [current]);
  return null;
}

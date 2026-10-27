/**
 * Add Customer — SwiftUI Form. Saved in the background (saveCustomer), then
 * offers to book them.
 */
import {
  Form,
  Section,
  Text,
  TextField,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  scrollDismissesKeyboard,
} from '@expo/ui/swift-ui/modifiers';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { SwiftModal } from '@/components/swiftui/SwiftModal';
import { colors } from '@/constants/theme';
import { saveCustomer } from '@/hooks/customerWrites';
import { findCachedCustomer } from '@/hooks/useCustomers';
import { showAlert } from '@/utils/alert';

type Field = 'name' | 'phone';

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/customers');
}

export default function AddCustomerScreen() {
  const params = useLocalSearchParams<{ name?: string; phone?: string }>();
  const nameText = useNativeState(params.name ?? '');
  const phoneText = useNativeState(params.phone ?? '');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  const validate = (): Partial<Record<Field, string>> => {
    const next: Partial<Record<Field, string>> = {};
    const trimmed = nameText.get().trim();
    if (!trimmed) next.name = '請輸入顧客姓名';
    else if (findCachedCustomer({ name: trimmed })) next.name = `已有同名顧客：${trimmed}`;
    const phone = phoneText.get();
    const digits = phone.replace(/[^\d]/g, '');
    if (phone.trim() && digits.length < 8) next.phone = '電話號碼最少 8 位數字';
    return next;
  };

  const handleSubmit = () => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    // Shows in the list at once and is sent in the background; a failure is reported then
    const created = saveCustomer({ name: nameText.get().trim(), phone: phoneText.get() });
    showAlert('新增預約？', `要為 ${created.name} 新增預約嗎？`, [
      { text: '稍後', style: 'cancel', onPress: close },
      {
        text: '新增預約',
        onPress: () =>
          router.replace({
            pathname: '/add-appointment',
            params: { customerName: created.name },
          }),
      },
    ]);
  };

  return (
    <SwiftModal onClose={close} onSave={handleSubmit}>
      <Form modifiers={[scrollDismissesKeyboard('immediately')]}>
        <Section title="顧客資料">
          <TextField
            placeholder="顧客姓名"
            text={nameText}
            onTextChange={() =>
              setErrors((prev) => {
                if (!prev.name) return prev;
                const next = { ...prev };
                delete next.name;
                return next;
              })
            }
          />
          {errors.name ? (
            <Text modifiers={[font({ size: 13 }), foregroundStyle(colors.danger)]}>{errors.name}</Text>
          ) : null}

          <TextField
            placeholder="電話（例如 91234567）"
            text={phoneText}
            onTextChange={() =>
              setErrors((prev) => {
                if (!prev.phone) return prev;
                const next = { ...prev };
                delete next.phone;
                return next;
              })
            }
          />
          {errors.phone ? (
            <Text modifiers={[font({ size: 13 }), foregroundStyle(colors.danger)]}>{errors.phone}</Text>
          ) : (
            <Text
              modifiers={[
                font({ size: 12 }),
                foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
              ]}
            >
              香港號碼會自動加上 852，方便 WhatsApp。
            </Text>
          )}
        </Section>
      </Form>
    </SwiftModal>
  );
}

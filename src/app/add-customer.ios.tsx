/**
 * Add Customer — SwiftUI Form. createCustomer API unchanged.
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
import { addCachedCustomer, findCachedCustomer } from '@/hooks/useCustomers';
import { createCustomer, isUsingMockApi } from '@/services/appointmentsApi';
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
  const [saving, setSaving] = useState(false);

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

  const handleSubmit = async () => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    try {
      setSaving(true);
      const created = await createCustomer({
        name: nameText.get().trim(),
        phone: phoneText.get(),
      });
      addCachedCustomer(created);

      showAlert(
        isUsingMockApi ? '已儲存（模擬）' : '已新增顧客',
        isUsingMockApi
          ? '目前使用 mock API，連上 Google Sheet 後會真正寫入。'
          : `${created.name} 已寫入 Google Sheet。`,
        [
          { text: '完成', style: 'cancel', onPress: close },
          {
            text: '新增預約',
            onPress: () =>
              router.replace({
                pathname: '/add-appointment',
                params: { customerName: created.name },
              }),
          },
        ]
      );
    } catch (e) {
      showAlert('儲存失敗', e instanceof Error ? e.message : '未知錯誤');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SwiftModal onClose={close} onSave={() => void handleSubmit()} saveDisabled={saving}>
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

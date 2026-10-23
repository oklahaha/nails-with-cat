/**
 * Add Customer — opened from the ＋ button on 顧客資料. Appends a row to the
 * 顧客 sheet via appointmentsApi.createCustomer(), then offers to book them.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, pressedStyle, radius, spacing, type } from '@/constants/theme';
import { addCachedCustomer, findCachedCustomer } from '@/hooks/useCustomers';
import { createCustomer, isUsingMockApi } from '@/services/appointmentsApi';
import { showAlert } from '@/utils/alert';

type Field = 'name' | 'phone';

function close() {
  // On web the page may be opened directly, with no history to go back to
  if (router.canGoBack()) router.back();
  else router.replace('/customers');
}

export default function AddCustomerScreen() {
  const insets = useSafeAreaInsets();
  // Optional prefill from an unmatched search in the customer list
  const params = useLocalSearchParams<{ name?: string; phone?: string }>();
  const [name, setName] = useState(params.name ?? '');
  const [phone, setPhone] = useState(params.phone ?? '');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [saving, setSaving] = useState(false);

  const validate = (): Partial<Record<Field, string>> => {
    const next: Partial<Record<Field, string>> = {};
    const trimmed = name.trim();
    if (!trimmed) next.name = '請輸入顧客姓名';
    else if (findCachedCustomer({ name: trimmed })) next.name = `已有同名顧客：${trimmed}`;
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
      const created = await createCustomer({ name: name.trim(), phone });
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

  const clearError = (field: Field) => {
    if (!errors[field]) return;
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 56 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.label}>顧客姓名</Text>
        <TextInput
          style={[styles.input, errors.name && styles.inputInvalid]}
          value={name}
          onChangeText={(text) => {
            setName(text);
            clearError('name');
          }}
          placeholder="姓名"
          placeholderTextColor={colors.textTertiary}
          autoCorrect={false}
          autoFocus={!params.name}
          returnKeyType="next"
        />
        {errors.name ? <Text style={styles.error}>{errors.name}</Text> : null}

        <Text style={[styles.label, styles.labelSpaced]}>電話</Text>
        <TextInput
          style={[styles.input, errors.phone && styles.inputInvalid]}
          value={phone}
          onChangeText={(text) => {
            setPhone(text);
            clearError('phone');
          }}
          placeholder="例如 91234567（可選填）"
          placeholderTextColor={colors.textTertiary}
          keyboardType="phone-pad"
          autoFocus={Boolean(params.name) && !params.phone}
          returnKeyType="done"
          onSubmitEditing={() => void handleSubmit()}
        />
        {errors.phone ? (
          <Text style={styles.error}>{errors.phone}</Text>
        ) : (
          <Text style={styles.hint}>香港號碼不用加 852，WhatsApp 會自動加上。</Text>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Pressable
          onPress={() => void handleSubmit()}
          disabled={saving}
          style={({ pressed }) => [styles.submitBtn, (pressed || saving) && pressedStyle]}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={styles.submitText}>儲存顧客</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  label: {
    ...type.label,
    marginBottom: spacing.sm,
  },
  labelSpaced: {
    marginTop: spacing.lg,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm + 6 : spacing.sm + 2,
    fontSize: 16,
    color: colors.text,
  },
  inputInvalid: {
    borderColor: colors.danger,
  },
  error: {
    marginTop: spacing.xs,
    color: colors.danger,
    fontSize: 13,
  },
  hint: {
    ...type.caption,
    marginTop: spacing.xs,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  submitBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md - 2,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  submitText: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '700',
  },
});

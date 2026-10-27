/**
 * Customer details — opened by tapping a customer in 顧客資料. Shows the
 * customer with 新增預約 and their booking history, and lets you
 * edit (in place) or delete the 顧客 row.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
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

import { CustomerHistory } from '@/components/CustomerHistory';
import { Icon } from '@/components/Icon';
import { StateView } from '@/components/StateView';
import { colors, pressedStyle, radius, spacing, type } from '@/constants/theme';
import { useCustomerAppointments } from '@/hooks/useAppointments';
import { removeCustomer, saveCustomer } from '@/hooks/customerWrites';
import { findCachedCustomer } from '@/hooks/useCustomers';
import type { Customer } from '@/types/customer';
import { showAlert } from '@/utils/alert';
import { formatPhone, localPhone } from '@/utils/phone';

function close() {
  // On web the page may be opened directly, with no history to go back to
  if (router.canGoBack()) router.back();
  else router.replace('/customers');
}

export default function CustomerDetailsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; name: string }>();
  const [customer, setCustomer] = useState<Customer | undefined>(() =>
    findCachedCustomer({ id: params.id, name: params.name ?? '' })
  );
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const history = useCustomerAppointments(
    customer ? { id: customer.id || undefined, name: customer.name } : undefined
  );

  // e.g. the web page was reloaded, so the customer list isn't loaded
  if (!customer) {
    return (
      <StateView
        icon="person"
        title="找不到此顧客"
        message="請返回顧客資料，再揀選顧客。"
        action={{ label: '返回', onPress: close }}
      />
    );
  }

  const startEditing = () => {
    setName(customer.name);
    setPhone(localPhone(customer.phone));
    setNameError(null);
    setEditing(true);
  };

  const handleSave = () => {
    if (!name.trim()) {
      setNameError('請輸入顧客姓名');
      return;
    }
    // Shows at once and is sent in the background; a failure is reported then
    setCustomer(saveCustomer({ name: name.trim(), phone }, customer));
    setEditing(false);
  };

  const handleDelete = () => {
    // Disappears at once and is sent in the background; a failure brings it back
    removeCustomer(customer);
    close();
  };

  const confirmDelete = () => {
    showAlert('刪除顧客？', `${customer.name}\n顧客的預約記錄會保留。刪除後無法復原。`, [
      { text: '取消', style: 'cancel' },
      { text: '刪除', style: 'destructive', onPress: () => void handleDelete() },
    ]);
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
        <View style={styles.hero}>
          <View style={styles.avatar}>
            {/* Array.from keeps emoji (surrogate pairs) whole */}
            <Text style={styles.avatarText}>
              {Array.from(editing ? name : customer.name)[0] ?? ''}
            </Text>
          </View>
          {editing ? null : <Text style={styles.title}>{customer.name}</Text>}
        </View>

        {editing ? (
          <>
            <Text style={styles.label}>顧客姓名</Text>
            <TextInput
              style={[styles.input, nameError && styles.inputInvalid]}
              value={name}
              onChangeText={(text) => {
                setName(text);
                setNameError(null);
              }}
              placeholder="姓名"
              placeholderTextColor={colors.textTertiary}
              autoCorrect={false}
              autoFocus
            />
            {nameError ? <Text style={styles.error}>{nameError}</Text> : null}
            {name.trim() !== customer.name ? (
              <Text style={styles.hint}>改名後，此顧客的預約記錄亦會一併更新。</Text>
            ) : null}

            <Text style={[styles.label, styles.labelSpaced]}>電話</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="例如 91234567"
              placeholderTextColor={colors.textTertiary}
              keyboardType="phone-pad"
            />
          </>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>電話</Text>
                <Text style={[styles.rowValue, !customer.phone && styles.rowValueMissing]}>
                  {formatPhone(customer.phone) || '未有電話'}
                </Text>
              </View>
              {customer.id ? (
                <View style={[styles.row, styles.rowDivider]}>
                  <Text style={styles.rowLabel}>顧客ID</Text>
                  <Text style={[styles.rowValue, styles.rowValueMuted]}>{customer.id}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.actions}>
              <Pressable
                onPress={() =>
                  router.replace({
                    pathname: '/add-appointment',
                    params: { customerName: customer.name },
                  })
                }
                style={({ pressed }) => [styles.bookBtn, pressed && pressedStyle]}
                accessibilityRole="button"
              >
                <Icon name="add" color={colors.accent} size={18} />
                <Text style={styles.bookText}>新增預約</Text>
              </Pressable>
            </View>

            <CustomerHistory
              appointments={history.appointments}
              loading={history.loading}
              error={history.error}
              onRetry={() => void history.reload()}
            />
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {editing ? (
          <>
            <Pressable
              onPress={() => setEditing(false)}
              style={({ pressed }) => [styles.secondaryBtn, pressed && pressedStyle]}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>取消</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              style={({ pressed }) => [styles.primaryBtn, pressed && pressedStyle]}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>儲存</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              onPress={confirmDelete}
              style={({ pressed }) => [styles.deleteBtn, pressed && pressedStyle]}
              accessibilityRole="button"
            >
              <Icon name="trash" color={colors.danger} size={18} />
              <Text style={styles.deleteText}>刪除</Text>
            </Pressable>
            <Pressable
              onPress={startEditing}
              style={({ pressed }) => [styles.primaryBtn, pressed && pressedStyle]}
              accessibilityRole="button"
            >
              <Icon name="edit" color={colors.onAccent} size={18} />
              <Text style={styles.primaryText}>修改</Text>
            </Pressable>
          </>
        )}
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
  hero: {
    alignItems: 'center',
    gap: spacing.sm + 4,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.md + 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
  },
  avatarText: {
    color: colors.accent,
    fontSize: 28,
    fontWeight: '700',
  },
  title: {
    ...type.title,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm + 6,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowLabel: {
    ...type.label,
    width: 52,
    lineHeight: 21,
  },
  rowValue: {
    ...type.body,
    ...type.time,
    flex: 1,
    lineHeight: 21,
  },
  rowValueMissing: {
    color: colors.textTertiary,
  },
  rowValueMuted: {
    ...type.caption,
    lineHeight: 21,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  bookBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md - 4,
    borderRadius: radius.pill,
    backgroundColor: colors.accentMuted,
  },
  bookText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '700',
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
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md - 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  deleteText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md - 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  secondaryText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  primaryBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md - 2,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  primaryText: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '700',
  },
});

/**
 * Add Appointment screen — basic form fields.
 *
 * On submit, calls appointmentsApi.createAppointment().
 * With mock API this only logs; later it will append a row to Google Sheet 預約資料.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { colors, radius, spacing } from '@/constants/theme';
import { createAppointment } from '@/services/appointmentsApi';
import type { ServiceType } from '@/types/appointment';

const SERVICES: ServiceType[] = ['整甲', '眼睫毛', '整甲 + 眼睫毛'];

export default function AddAppointmentScreen() {
  const [customerName, setCustomerName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [service, setService] = useState<ServiceType>('整甲');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const validate = (): string | null => {
    if (!customerName.trim()) return '請輸入顧客姓名';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      return '日期格式請用 YYYY-MM-DD（例如 2026-10-25）';
    }
    if (!/^\d{2}:\d{2}$/.test(time.trim())) {
      return '時間格式請用 HH:mm（例如 14:30）';
    }
    return null;
  };

  const handleSubmit = async () => {
    const error = validate();
    if (error) {
      Alert.alert('資料不完整', error);
      return;
    }

    try {
      setSaving(true);
      await createAppointment({
        customerName,
        date,
        time,
        service,
        notes,
      });

      Alert.alert('已儲存（模擬）', '目前使用 mock API，連上 Google Sheet 後會真正寫入。', [
        { text: '好', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('儲存失敗', e instanceof Error ? e.message : '未知錯誤');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <FieldLabel text="顧客姓名" />
        <TextInput
          style={styles.input}
          value={customerName}
          onChangeText={setCustomerName}
          placeholder="例如：陳小美"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="words"
        />

        <FieldLabel text="日期 (YYYY-MM-DD)" />
        <TextInput
          style={styles.input}
          value={date}
          onChangeText={setDate}
          placeholder="2026-10-25"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <FieldLabel text="時間 (HH:mm)" />
        <TextInput
          style={styles.input}
          value={time}
          onChangeText={setTime}
          placeholder="14:30"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <FieldLabel text="服務 (活動)" />
        <View style={styles.serviceRow}>
          {SERVICES.map((option) => {
            const selected = service === option;
            return (
              <Pressable
                key={option}
                onPress={() => setService(option)}
                style={[
                  styles.serviceChip,
                  selected && styles.serviceChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.serviceChipText,
                    selected && styles.serviceChipTextSelected,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <FieldLabel text="備注" />
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="可選填"
          placeholderTextColor={colors.textSecondary}
          multiline
          textAlignVertical="top"
        />

        <Pressable
          onPress={() => void handleSubmit()}
          disabled={saving}
          style={({ pressed }) => [
            styles.submitBtn,
            (pressed || saving) && styles.submitBtnPressed,
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>儲存預約</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FieldLabel({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
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
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    fontSize: 16,
    color: colors.text,
  },
  notesInput: {
    minHeight: 96,
    paddingTop: spacing.md,
  },
  serviceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  serviceChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  serviceChipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  serviceChipText: {
    color: colors.textSecondary,
    fontWeight: '500',
  },
  serviceChipTextSelected: {
    color: colors.accent,
    fontWeight: '700',
  },
  submitBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  submitBtnPressed: {
    opacity: 0.85,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

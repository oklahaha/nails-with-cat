/**
 * Add / Edit Appointment screen.
 *
 * 活動 is picked first, from a dropdown that starts empty; the rest of the
 * form only appears once it's chosen. 特別事項 has its own short form (備注,
 * 日期, 時間, End Time) and is saved without a customer, with Duration taken
 * from End Time − 時間 and 備注 copied into View.
 *
 * Customer name suggests existing customers; date and time are picked rather
 * than typed, and the time slots flag clashes with that day's bookings.
 * With an `id` param it edits that appointment (taken from the loaded
 * appointments) and saves the edit; otherwise it creates one. Either way
 * saveAppointment() shows it at once and sends it in the background.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useState } from 'react';
import {
  Keyboard,
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

import { DatePicker } from '@/components/form/DatePicker';
import { ServicePicker } from '@/components/form/ServicePicker';
import { TimeSlotPicker } from '@/components/form/TimeSlotPicker';
import { StateView } from '@/components/StateView';
import {
  usesDeposit,
  usesHandOrFoot,
  HAND_OR_FOOT_OPTIONS,
  COMPLEX_DESIGN_OPTIONS,
  NAIL_EXTRAS,
} from '@/constants/services';
import { colors, pressedStyle, radius, spacing, type } from '@/constants/theme';
import { useAppointmentForm } from '@/hooks/useAppointmentForm';
import { findCachedAppointment } from '@/hooks/useAppointments';
import { formatDateHeader } from '@/utils/groupByDate';

/** 訂金 is TRUE / FALSE in the sheet. */
const DEPOSIT_OPTIONS = [
  { label: '已付', value: true },
  { label: '未付', value: false },
] as const;

const HHMM = /^\d{2}:\d{2}$/;

/** 狀態 choices when editing (特別事項 rows may also be blank). */
const STATUS_OPTIONS = ['預約', '已完成'] as const;

export default function AddAppointmentScreen() {
  const insets = useSafeAreaInsets();
  // Optional prefill from the calendar (date) or the customer list (customerName),
  // or the appointment to edit (id)
  const params = useLocalSearchParams<{ id?: string; date?: string; customerName?: string }>();
  // Snapshot at open, so a background reload doesn't reset the form
  const [editing] = useState(() => (params.id ? findCachedAppointment(params.id) : undefined));
  const {
    service,
    changeService: handleServiceChange,
    customerName,
    setCustomerName,
    suggestions,
    date,
    setDate,
    time,
    setTime,
    endTimeInput,
    setEndTimeInput,
    handOrFoot,
    setHandOrFoot,
    deposit,
    setDeposit,
    complexDesign,
    setComplexDesign,
    nailExtras,
    setNailExtra,
    status,
    setStatus,
    setPriceEdited,
    autoPrice,
    followAutoPrice,
    topUpHint,
    isSpecial,
    showNailExtras,
    validTime,
    validEndTime,
    duration,
    endTime,
    endTimeError,
    dayBookings,
    otherBookings,
    errors,
    clearError,
    submit,
  } = useAppointmentForm({
    editing,
    // Date and time start blank: they're picked from the calendar and slot list
    initial: { customerName: params.customerName, date: params.date ?? '', time: '', status: '' },
    requireSpecialEndTime: true,
  });
  // Suggestions show while typing and hide once one is picked
  const [suggesting, setSuggesting] = useState(false);
  const [price, setPrice] = useState(editing?.price != null ? String(editing.price) : '');
  const [notes, setNotes] = useState(editing?.notes ?? '');

  // 收費 follows its default until typed by hand; applied during render when
  // it changes, rather than in an effect
  const autoPriceState = `${followAutoPrice}:${autoPrice}`;
  const [appliedAutoPrice, setAppliedAutoPrice] = useState<string>();
  if (autoPriceState !== appliedAutoPrice) {
    setAppliedAutoPrice(autoPriceState);
    if (autoPrice != null && followAutoPrice) setPrice(String(autoPrice));
  }

  const handleSubmit = () =>
    submit({ customerName, notes, price }, () => {
      // On web the page may be opened directly, with no history to go back to
      if (router.canGoBack()) router.back();
      else router.replace('/');
    });

  const hasErrors = Object.keys(errors).length > 0;

  // e.g. the web page was reloaded, so the appointment list isn't loaded
  if (params.id && !editing) {
    return (
      <StateView
        icon="calendar"
        title="找不到此預約"
        message="請返回時間表，再揀選要修改的預約。"
        action={{
          label: '返回',
          onPress: () => (router.canGoBack() ? router.back() : router.replace('/')),
        }}
      />
    );
  }

  const dateSection = (
    <Section title="日期">
      <DatePicker
        value={date}
        onChange={(d) => {
          setDate(d);
          clearError('date');
        }}
        invalid={Boolean(errors.date)}
      />
      <FieldError message={errors.date} />
    </Section>
  );

  const timeSection = (
    <Section
      title="開始時間"
      hint={endTime ? `${time} – ${endTime}（${duration} 分鐘）` : undefined}
    >
      {date ? (
        <TimeSlotPicker
          value={time}
          onChange={(t) => {
            setTime(t);
            clearError('time');
            // An end time now before the start has to be picked again
            if (HHMM.test(t) && validEndTime && endTimeInput < t) setEndTimeInput('');
          }}
          durationMinutes={duration}
          bookings={otherBookings}
          loadingBookings={dayBookings.loading}
          invalid={Boolean(errors.time)}
        />
      ) : (
        <Text style={styles.placeholderNote}>先選擇日期，再揀時段</Text>
      )}
      <FieldError message={errors.time} />
    </Section>
  );

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
        <Section title="活動">
          <ServicePicker
            value={service}
            onChange={handleServiceChange}
            invalid={Boolean(errors.service)}
          />
          <FieldError message={errors.service} />
        </Section>

        {!service ? null : isSpecial ? (
          <>
            <Section title="備注">
              <TextInput
                style={[styles.input, styles.notesInput, styles.notesInputFirst]}
                value={notes}
                onChangeText={setNotes}
                placeholder="輸入特別事項內容"
                placeholderTextColor={colors.textTertiary}
                multiline
                textAlignVertical="top"
              />
            </Section>

            {dateSection}
            {timeSection}

            <Section title="完結時間">
              {validTime ? (
                <TimeSlotPicker
                  value={endTimeInput}
                  onChange={(t) => {
                    setEndTimeInput(t);
                    clearError('endTime');
                  }}
                  minTime={time}
                  invalid={Boolean(endTimeError)}
                />
              ) : (
                <Text style={styles.placeholderNote}>先選擇開始時間，再揀完結時間</Text>
              )}
              <FieldError message={endTimeError} />
            </Section>
          </>
        ) : (
          <>
            <Section title="顧客">
              <TextInput
                style={[styles.input, errors.customerName && styles.inputInvalid]}
                value={customerName}
                onChangeText={(text) => {
                  setCustomerName(text);
                  setSuggesting(true);
                  clearError('customerName');
                }}
                placeholder="輸入姓名搜尋或新增"
                placeholderTextColor={colors.textTertiary}
                autoCorrect={false}
                returnKeyType="done"
              />
              {suggesting && suggestions.length > 0 ? (
                <View style={styles.suggestions}>
                  {suggestions.map((c, i) => (
                    <Pressable
                      key={c.id || c.name}
                      onPress={() => {
                        setCustomerName(c.name);
                        setSuggesting(false);
                        clearError('customerName');
                        Keyboard.dismiss();
                      }}
                      style={({ pressed }) => [
                        styles.suggestion,
                        i > 0 && styles.suggestionDivider,
                        pressed && styles.suggestionPressed,
                      ]}
                      accessibilityRole="button"
                    >
                      <Text style={styles.suggestionName}>{c.name}</Text>
                      {c.phone ? <Text style={styles.suggestionPhone}>{c.phone}</Text> : null}
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <FieldError message={errors.customerName} />
            </Section>

            {dateSection}
            {timeSection}

            {usesHandOrFoot(service) ? (
              <Section title="手/腳">
                <View style={styles.segmented}>
                  {HAND_OR_FOOT_OPTIONS.map((option) => {
                    const selected = handOrFoot === option;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => setHandOrFoot(option)}
                        style={[styles.segment, selected && styles.segmentSelected]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Section>
            ) : null}

            {showNailExtras ? (
              <Section title="複雜款">
                <View style={styles.segmented}>
                  {COMPLEX_DESIGN_OPTIONS.map((option) => {
                    const selected = complexDesign === option;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => setComplexDesign(option)}
                        style={[styles.segment, selected && styles.segmentSelected]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Section>
            ) : null}

            {showNailExtras ? (
              <Section title="附加">
                <View style={styles.chipRow}>
                  {NAIL_EXTRAS.map(({ key, label }) => {
                    const selected = nailExtras[key];
                    return (
                      <Pressable
                        key={key}
                        onPress={() => setNailExtra(key, !selected)}
                        style={[styles.chip, selected && styles.extraChipSelected]}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Section>
            ) : null}

            {usesDeposit(service) ? (
              <Section title="訂金">
                <View style={styles.segmented}>
                  {DEPOSIT_OPTIONS.map((option) => {
                    const selected = deposit === option.value;
                    return (
                      <Pressable
                        key={option.label}
                        onPress={() => setDeposit(option.value)}
                        style={[styles.segment, selected && styles.segmentSelected]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Section>
            ) : null}

            <Section title="收費及備注">
              <View style={[styles.priceField, errors.price && styles.inputInvalid]}>
                <Text style={styles.pricePrefix}>$</Text>
                <TextInput
                  style={styles.priceInput}
                  value={price}
                  onChangeText={(text) => {
                    setPrice(text);
                    setPriceEdited(true);
                    clearError('price');
                  }}
                  placeholder="可選填"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                />
              </View>
              <FieldError message={errors.price} />
              {topUpHint ? <Text style={styles.priceHint}>{topUpHint}</Text> : null}

              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="備注（可選填）"
                placeholderTextColor={colors.textTertiary}
                multiline
                textAlignVertical="top"
              />
            </Section>

            {editing ? (
              <Section title="狀態">
                <View style={styles.segmented}>
                  {STATUS_OPTIONS.map((option) => {
                    const selected = status === option;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => setStatus(option)}
                        style={[styles.segment, selected && styles.segmentSelected]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Section>
            ) : null}
          </>
        )}
      </ScrollView>

      {service ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Text style={[styles.summary, hasErrors && styles.summaryError]} numberOfLines={1}>
            {hasErrors
              ? '請完成紅色標示的欄位'
              : date && validTime
                ? `${formatDateHeader(date)} ${time}${endTime ? `–${endTime}` : ''} · ${service}`
                : service}
          </Text>
          <Pressable
            onPress={handleSubmit}
            style={({ pressed }) => [styles.submitBtn, pressed && pressedStyle]}
            accessibilityRole="button"
          >
            <Text style={styles.submitText}>{editing ? '儲存變更' : '儲存預約'}</Text>
          </Pressable>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <Text style={styles.error}>{message}</Text> : null;
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
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...type.label,
  },
  sectionHint: {
    ...type.time,
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  subLabel: {
    ...type.label,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
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
  notesInput: {
    minHeight: 88,
    marginTop: spacing.sm,
    paddingTop: spacing.sm + 4,
  },
  notesInputFirst: {
    marginTop: 0,
  },
  suggestions: {
    marginTop: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  suggestionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  suggestionPressed: {
    backgroundColor: colors.border,
  },
  suggestionName: {
    ...type.body,
    fontWeight: '600',
  },
  suggestionPhone: {
    ...type.caption,
    ...type.time,
  },
  placeholderNote: {
    ...type.caption,
    paddingVertical: spacing.md,
    textAlign: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md - 4,
    paddingVertical: spacing.sm + 1,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  extraChipSelected: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: colors.text,
    fontWeight: '700',
  },
  segmented: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.sm + 2,
    backgroundColor: colors.surface,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  segmentSelected: {
    backgroundColor: colors.surfaceRaised,
  },
  segmentText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  segmentTextSelected: {
    color: colors.text,
    fontWeight: '700',
  },
  priceField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
  },
  pricePrefix: {
    color: colors.textSecondary,
    fontSize: 16,
    marginRight: spacing.xs,
  },
  priceInput: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm + 6 : spacing.sm + 2,
    fontSize: 16,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  priceHint: {
    marginTop: spacing.xs,
    color: colors.danger,
    fontSize: 13,
  },
  error: {
    marginTop: spacing.xs,
    color: colors.danger,
    fontSize: 13,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  summary: {
    ...type.caption,
    ...type.time,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  summaryError: {
    color: colors.danger,
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

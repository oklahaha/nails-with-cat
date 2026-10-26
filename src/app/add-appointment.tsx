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
 * appointments) and saves via appointmentsApi.updateAppointment(); otherwise
 * it calls appointmentsApi.createAppointment().
 */
import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
  defaultDurationFor,
  defaultPriceFor,
  usesDeposit,
  usesHandOrFoot,
  nailExtrasOf,
  toComplexDesign,
  showsNailExtras,
  usesNailExtras,
  viewFor,
  HAND_OR_FOOT_OPTIONS,
  COMPLEX_DESIGN_OPTIONS,
  NO_NAIL_EXTRAS,
  NAIL_EXTRAS,
  type ComplexDesign,
  type HandOrFoot,
  type NailExtra,
} from '@/constants/services';
import { colors, pressedStyle, radius, spacing, type } from '@/constants/theme';
import { findCachedAppointment, useAppointments } from '@/hooks/useAppointments';
import { useCustomers } from '@/hooks/useCustomers';
import {
  createAppointment,
  isUsingMockApi,
  updateAppointment,
} from '@/services/appointmentsApi';
import type { ServiceType } from '@/types/appointment';
import { showAlert } from '@/utils/alert';
import { addDays, minutesToTime, timeToMinutes } from '@/utils/dates';
import { formatDateHeader } from '@/utils/groupByDate';
import { lastSetDate, lastSetHint, topUpPrice as topUpPriceFor, topUpRuleFor } from '@/utils/topUpPrice';
import { describeOverlaps, findOverlaps } from '@/utils/overlap';

type Field = 'service' | 'customerName' | 'date' | 'time' | 'endTime' | 'price';

/** 訂金 is TRUE / FALSE in the sheet. */
const DEPOSIT_OPTIONS = [
  { label: '已付', value: true },
  { label: '未付', value: false },
] as const;

const SPECIAL: ServiceType = '特別事項';
const HHMM = /^\d{2}:\d{2}$/;

/** Customer suggestions shown under the name field. */
const MAX_SUGGESTIONS = 5;

/** 狀態 choices when editing (特別事項 rows may also be blank). */
const STATUS_OPTIONS = ['預約', '已完成'] as const;

export default function AddAppointmentScreen() {
  const insets = useSafeAreaInsets();
  // Optional prefill from the calendar (date) or the customer list (customerName),
  // or the appointment to edit (id)
  const params = useLocalSearchParams<{ id?: string; date?: string; customerName?: string }>();
  // Snapshot at open, so a background reload doesn't reset the form
  const [editing] = useState(() => (params.id ? findCachedAppointment(params.id) : undefined));
  const [customerName, setCustomerName] = useState(
    editing?.customerName ?? params.customerName ?? ''
  );
  // Suggestions show while typing and hide once one is picked
  const [suggesting, setSuggesting] = useState(false);
  const [date, setDate] = useState(editing?.date ?? params.date ?? '');
  const [time, setTime] = useState(editing?.time ?? '');
  // Only used by 特別事項, where it's picked rather than derived from the service
  const [endTimeInput, setEndTimeInput] = useState(editing?.endTime ?? '');
  // Old rows may hold services / 手腳 values not in the lists; they're kept as-is
  const [service, setService] = useState<ServiceType | ''>(
    (editing?.service as ServiceType | undefined) ?? ''
  );
  const [handOrFoot, setHandOrFootState] = useState<HandOrFoot>(
    (editing?.handOrFoot as HandOrFoot | undefined) ?? (editing ? ('' as HandOrFoot) : '手')
  );
  const [price, setPrice] = useState(
    editing?.price != null ? String(editing.price) : ''
  );
  const [deposit, setDeposit] = useState(editing?.deposit ?? false);
  const [complexDesign, setComplexDesignState] = useState(() =>
    toComplexDesign(editing?.complexDesign)
  );
  const setHandOrFoot = (value: HandOrFoot) => {
    setHandOrFootState(value);
    // 整甲 takes a different default Duration for 腳 and 手 + 腳
    setKeepDuration(false);
  };
  const setComplexDesign = (value: ComplexDesign) => {
    setComplexDesignState(value);
    // Changes the default Duration, so an edited booking takes it up too
    setKeepDuration(false);
  };
  const [nailExtras, setNailExtras] = useState(() => nailExtrasOf(editing));
  const setNailExtra = (key: NailExtra, on: boolean) => {
    setNailExtras((prev) => ({ ...prev, [key]: on }));
    // 拆甲 and 延長 change the default Duration too
    setKeepDuration(false);
  };
  // Once the price is typed by hand, changing service no longer overwrites it
  const [priceEdited, setPriceEdited] = useState(editing != null);
  // An edited booking keeps its own Duration until the service is changed
  const [keepDuration, setKeepDuration] = useState(editing != null);
  const [status, setStatus] = useState(editing?.status ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  const { customers } = useCustomers();
  const dayBookings = useAppointments({ from: date, to: date }, { enabled: date !== '' });
  // The booking being edited shouldn't clash with itself
  const otherBookings = useMemo(
    () => dayBookings.appointments.filter((apt) => apt.id !== editing?.id),
    [dayBookings.appointments, editing]
  );

  const showNailExtras = showsNailExtras(service, handOrFoot);
  // Hidden add-ons are saved cleared, so a booking switched to 腳 drops them
  const appliedNailExtras = showNailExtras ? { complexDesign, ...nailExtras } : NO_NAIL_EXTRAS;

  // 補眼睫毛 / 補甲: once a known customer is picked, 收費 follows their last set
  const topUp = topUpRuleFor(service);
  const isTopUp = topUp != null;
  const customerPicked = customers.some((c) => c.name === customerName.trim());
  const setHistory = useAppointments(
    { from: date && addDays(date, -(topUp?.lookbackDays ?? 0)), to: date },
    { enabled: isTopUp && customerPicked && date !== '' }
  );
  const topUpReady =
    topUp != null && customerPicked && date !== '' && !setHistory.loading && !setHistory.error;
  const topUpPrice = topUpReady
    ? topUpPriceFor(topUp, setHistory.appointments, customerName, date, editing?.id)
    : undefined;
  // Shown under 收費 so it's clear where the price came from
  const topUpHint = topUpReady
    ? lastSetHint(
        topUp,
        lastSetDate(topUp, setHistory.appointments, customerName, date, editing?.id),
        date
      )
    : undefined;
  // Follows the service, 手/腳 and add-ons until 收費 is typed by hand
  const autoPrice =
    topUpPrice ??
    (service ? defaultPriceFor(service, { handOrFoot, ...appliedNailExtras }) : undefined);
  // Applied during render when it changes, rather than in an effect
  const [appliedAutoPrice, setAppliedAutoPrice] = useState<number>();
  if (autoPrice !== appliedAutoPrice) {
    setAppliedAutoPrice(autoPrice);
    if (autoPrice != null && !priceEdited) setPrice(String(autoPrice));
  }

  const isSpecial = service === SPECIAL;
  const validTime = HHMM.test(time);
  const validEndTime = HHMM.test(endTimeInput);
  // 特別事項: Duration = End Time − 時間 (none when they're equal)
  const specialDuration =
    validTime && validEndTime ? timeToMinutes(endTimeInput) - timeToMinutes(time) : undefined;
  const duration = isSpecial
    ? specialDuration && specialDuration > 0
      ? specialDuration
      : undefined
    : keepDuration
      ? editing?.durationMinutes
      : service
        ? defaultDurationFor(service, { handOrFoot, ...appliedNailExtras })
        : undefined;
  const endTime = validTime && duration ? minutesToTime(timeToMinutes(time) + duration) : null;
  // Shown as soon as a typed end time is before the start, not only on save
  const endTimeError =
    errors.endTime ??
    (specialDuration != null && specialDuration < 0 ? '完結時間不可早於開始時間' : undefined);

  const suggestions = useMemo(() => {
    const q = customerName.trim().toLowerCase();
    if (!q) return [];
    if (customers.some((c) => c.name.toLowerCase() === q)) return [];
    return customers.filter((c) => c.name.toLowerCase().includes(q)).slice(0, MAX_SUGGESTIONS);
  }, [customers, customerName]);

  const clearError = (field: Field) => {
    if (!errors[field]) return;
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleServiceChange = (next: ServiceType) => {
    setService(next);
    clearError('service');
    setKeepDuration(false);
  };

  const validate = (): Partial<Record<Field, string>> => {
    const next: Partial<Record<Field, string>> = {};
    if (!service) next.service = '請選擇活動';
    if (!isSpecial && !customerName.trim()) next.customerName = '請輸入顧客姓名';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) next.date = '請選擇日期';
    if (!time) next.time = '請選擇開始時間';
    else if (!validTime) next.time = '時間格式請用 HH:mm（例如 14:30）';
    if (isSpecial) {
      if (!endTimeInput) next.endTime = '請選擇完結時間';
      else if (!validEndTime) next.endTime = '時間格式請用 HH:mm（例如 14:30）';
      else if (specialDuration != null && specialDuration < 0)
        next.endTime = '完結時間不可早於開始時間';
    } else if (price.trim() && !/^\d+$/.test(price.trim())) {
      next.price = '收費請只輸入數字';
    }
    return next;
  };

  const handleSubmit = () => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0 || !service) return;

    // Overlaps are sometimes intended, so they only need confirming
    const overlaps = findOverlaps(otherBookings, time, duration);
    if (overlaps.length > 0) {
      showAlert(
        '時間重疊',
        `此時段與以下預約時間重疊：\n${describeOverlaps(overlaps)}\n\n仍然要儲存嗎？`,
        [
          { text: '返回修改', style: 'cancel' },
          { text: '仍然儲存', onPress: () => void save() },
        ]
      );
      return;
    }
    void save();
  };

  const save = async () => {
    if (!service) return;
    try {
      setSaving(true);
      // 特別事項 rows have no customer, 手/腳, 收費 or 狀態, and View repeats 備注
      const input = isSpecial
        ? { customerName: '', date, time, service, notes, view: notes, durationMinutes: duration }
        : {
            customerName,
            date,
            time,
            service,
            notes,
            view: viewFor(service, customerName),
            durationMinutes: duration,
            handOrFoot: usesHandOrFoot(service) ? handOrFoot : undefined,
            price: price.trim() ? Number(price.trim()) : undefined,
            // Other services leave 訂金 and the add-ons untouched
            deposit: usesDeposit(service) ? deposit : undefined,
            ...(usesNailExtras(service) ? appliedNailExtras : {}),
          };
      if (editing) {
        await updateAppointment(editing.id, { ...input, status: isSpecial ? '' : status });
      } else {
        await createAppointment(input);
      }

      showAlert(
        isUsingMockApi ? '已儲存（模擬）' : '已儲存',
        isUsingMockApi
          ? '目前使用 mock API，連上 Google Sheet 後會真正寫入。'
          : `${isSpecial ? '' : `${customerName.trim()} `}${formatDateHeader(date)} ${time} ` +
            `的${isSpecial ? '特別事項' : '預約'}已${editing ? '更新' : '寫入'} Google Sheet。`,
        [
          {
            text: '好',
            // On web the page may be opened directly, with no history to go back to
            onPress: () => (router.canGoBack() ? router.back() : router.replace('/')),
          },
        ]
      );
    } catch (e) {
      showAlert('儲存失敗', e instanceof Error ? e.message : '未知錯誤');
    } finally {
      setSaving(false);
    }
  };

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
            disabled={saving}
            style={({ pressed }) => [styles.submitBtn, (pressed || saving) && pressedStyle]}
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={styles.submitText}>{editing ? '儲存變更' : '儲存預約'}</Text>
            )}
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

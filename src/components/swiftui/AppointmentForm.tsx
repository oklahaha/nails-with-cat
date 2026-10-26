/**
 * The add / edit appointment form (SwiftUI), as a whole SwiftModal with ✕ and
 * ✓ in the header. Used by the add-appointment route, and by
 * appointment-details, which swaps to it in place when 修改 is tapped.
 * create/update API unchanged.
 */
import {
  Button,
  DatePicker,
  Form,
  HStack,
  Image,
  Label,
  LabeledContent,
  Menu,
  Picker,
  Section,
  Spacer,
  Text,
  TextField,
  Toggle,
  useNativeState,
  VStack,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  contentShape,
  datePickerStyle,
  environment,
  id,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  keyboardType,
  labelsHidden,
  multilineTextAlignment,
  pickerStyle,
  scrollDismissesKeyboard,
  shapes,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  defaultDurationFor,
  defaultPriceFor,
  nailExtrasOf,
  toComplexDesign,
  usesDeposit,
  usesHandOrFoot,
  showsNailExtras,
  usesNailExtras,
  viewFor,
  HAND_OR_FOOT_OPTIONS,
  COMPLEX_DESIGN_OPTIONS,
  NO_NAIL_EXTRAS,
  NAIL_EXTRAS,
  SERVICES,
  serviceColor,
  type ComplexDesign,
  type HandOrFoot,
  type NailExtra,
} from '@/constants/services';
import { colors } from '@/constants/theme';
import { useAppointments } from '@/hooks/useAppointments';
import { useCustomers } from '@/hooks/useCustomers';
import {
  createAppointment,
  isUsingMockApi,
  updateAppointment,
} from '@/services/appointmentsApi';
import type { Appointment, ServiceType } from '@/types/appointment';
import { showAlert } from '@/utils/alert';
import { appointmentTitle } from '@/utils/appointmentTitle';
import { addDays, minutesToTime, timeToMinutes, todayIsoDate } from '@/utils/dates';
import { formatDateHeader } from '@/utils/groupByDate';
import { lastSetDate, lastSetHint, topUpPrice as topUpPriceFor, topUpRuleFor } from '@/utils/topUpPrice';
import { describeOverlaps, findOverlaps } from '@/utils/overlap';
import { formatPhone } from '@/utils/phone';

import { dateToIso, dateToTime, isoToDate, timeToDate } from './dateIso';
import { SwiftModal } from './SwiftModal';

type Field = 'service' | 'customerName' | 'date' | 'time' | 'endTime' | 'price';

const SPECIAL: ServiceType = '特別事項';
const STATUS_OPTIONS = ['預約', '已完成'] as const;
/** Same styling as @expo/ui's DateTimePicker drop-in: accent tint, Chinese month/weekday names. */
const PICKER_LOOK = [tint(colors.accent), environment('locale', 'zh_Hant_HK')];

type Props = {
  /** The appointment to edit; leave out to add a new one. */
  editing?: Appointment;
  /** Prefills for a new appointment. */
  defaults?: { date?: string; customerName?: string };
  onClose: () => void;
  /** Called after the save is confirmed, with the record as written. */
  onSaved: (saved: Appointment) => void;
  /** Extra sections at the end of the form (e.g. 刪除預約). */
  children?: ReactNode;
};

export function AppointmentForm({ editing, defaults, onClose, onSaved, children }: Props) {
  const params = defaults ?? {};

  const [service, setService] = useState<ServiceType | ''>(
    (editing?.service as ServiceType | undefined) ?? ''
  );
  const customerNameText = useNativeState(editing?.customerName ?? params.customerName ?? '');
  const notesText = useNativeState(editing?.notes ?? '');
  const priceTextState = useNativeState(
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
  const [customerQuery, setCustomerQuery] = useState(
    editing?.customerName ?? params.customerName ?? ''
  );
  // Starts on today, so 開始 can be picked straight away
  const [date, setDate] = useState(editing?.date ?? params.date ?? todayIsoDate());
  // Starts on a value too, since the time picker always shows one
  const [time, setTime] = useState(editing?.time ?? defaultStartTime());
  const [endTimeInput, setEndTimeInput] = useState(editing?.endTime ?? '');
  const [handOrFoot, setHandOrFootState] = useState<HandOrFoot>(
    (editing?.handOrFoot as HandOrFoot | undefined) ?? (editing ? ('' as HandOrFoot) : '手')
  );
  const [priceEdited, setPriceEdited] = useState(editing != null);
  const [keepDuration, setKeepDuration] = useState(editing != null);
  const [status, setStatus] = useState(editing?.status ?? '預約');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  const { customers } = useCustomers();
  const dayBookings = useAppointments({ from: date, to: date }, { enabled: date !== '' });
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
  const customerPicked = customers.some((c) => c.name === customerQuery.trim());
  const setHistory = useAppointments(
    { from: addDays(date, -(topUp?.lookbackDays ?? 0)), to: date },
    { enabled: isTopUp && customerPicked }
  );
  const topUpReady = topUp != null && customerPicked && !setHistory.loading && !setHistory.error;
  const topUpPrice = topUpReady
    ? topUpPriceFor(topUp, setHistory.appointments, customerQuery, date, editing?.id)
    : undefined;
  // Shown under 收費 so it's clear where the price came from
  const topUpHint = topUpReady
    ? lastSetHint(
        topUp,
        lastSetDate(topUp, setHistory.appointments, customerQuery, date, editing?.id),
        date
      )
    : undefined;
  // Follows the service, 手/腳 and add-ons until 收費 is typed by hand
  const autoPrice =
    topUpPrice ??
    (service ? defaultPriceFor(service, { handOrFoot, ...appliedNailExtras }) : undefined);
  useEffect(() => {
    if (autoPrice != null && !priceEdited) priceTextState.set(String(autoPrice));
  }, [autoPrice, priceEdited, priceTextState]);

  const isSpecial = service === SPECIAL;
  const HHMM = /^\d{2}:\d{2}$/;
  const validTime = HHMM.test(time);
  const validEndTime = HHMM.test(endTimeInput);
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

  const suggestions = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return [];
    if (customers.some((c) => c.name.toLowerCase() === q)) return [];
    return customers.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 5);
  }, [customers, customerQuery]);

  const clearError = (field: Field) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
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
    if (!isSpecial && !customerNameText.get().trim()) next.customerName = '請輸入顧客姓名';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) next.date = '請選擇日期';
    if (!time) next.time = '請選擇時間';
    else if (!validTime) next.time = '時間格式請用 HH:mm';
    if (isSpecial) {
      // A blank 完結 shows (and saves as) the start time
      if (endTimeInput && !validEndTime) next.endTime = '時間格式請用 HH:mm';
      else if (specialDuration != null && specialDuration < 0)
        next.endTime = '完結時間不可早於開始時間';
    } else if (priceTextState.get().trim() && !/^\d+$/.test(priceTextState.get().trim())) {
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

    const customerName = customerNameText.get();
    const notes = notesText.get();
    const price = priceTextState.get();

    let saved: Appointment;
    try {
      setSaving(true);
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
        saved = await updateAppointment(editing.id, { ...input, status: isSpecial ? '' : status });
      } else {
        saved = await createAppointment(input);
      }

      showAlert(
        isUsingMockApi ? '已儲存（模擬）' : '已儲存',
        isUsingMockApi
          ? '目前使用 mock API，連上 Google Sheet 後會真正寫入。'
          : `${isSpecial ? '' : `${customerName.trim()} `}${formatDateHeader(date)} ${time} ` +
            `的${isSpecial ? '特別事項' : '預約'}已${editing ? '更新' : '寫入'} Google Sheet。`,
        [
          { text: '好', onPress: () => onSaved(saved) },
        ]
      );
    } catch (e) {
      showAlert('儲存失敗', e instanceof Error ? e.message : '未知錯誤');
    } finally {
      setSaving(false);
    }
  };

  const endBeforeStart = specialDuration != null && specialDuration < 0;
  // Shown as soon as 完結 is before 開始, not only on save
  const endTimeError =
    errors.endTime ?? (isSpecial && endBeforeStart ? '完結時間不可早於開始時間' : undefined);
  // Only once the range is valid; save asks to confirm these
  const clashes =
    validTime && !(isSpecial && endBeforeStart) ? findOverlaps(otherBookings, time, duration) : [];
  const knownCustomer = customers.find((c) => c.name === customerQuery.trim());

  const errorText = (field: Field) =>
    errors[field] ? (
      <Text modifiers={[font({ size: 13 }), foregroundStyle(colors.danger)]}>{errors[field]}</Text>
    ) : null;

  return (
    <SwiftModal
      onClose={onClose}
      onSave={handleSubmit}
      saveDisabled={saving || !service}
    >
      <Form modifiers={[scrollDismissesKeyboard('immediately')]}>
        <Section footer={!service ? <Text>先揀活動，再填其他資料</Text> : undefined}>
          {/* Two columns: the 活動 label stays put on the left, and the right
              column is the Menu, wide enough that tapping anywhere in it opens
              the options (a menu Picker only reacts on its value). The menu
              grows out of that column, so the label stays visible. */}
          <HStack spacing={8}>
            {/* Plain Image + Text rather than a Label, which showed only its icon here */}
            <HStack spacing={8} modifiers={[fixedSize()]}>
              {/* The calendar colour of the chosen service */}
              <Image
                systemName="circle.fill"
                size={12}
                color={service ? serviceColor(service) : colors.textTertiary}
              />
              <Text modifiers={[foregroundStyle(colors.text)]}>活動</Text>
            </HStack>
            <Menu
              label={
                <HStack
                  spacing={6}
                  modifiers={[frame({ maxWidth: Infinity }), contentShape(shapes.rectangle())]}
                >
                  <Spacer />
                  <Text
                    modifiers={[foregroundStyle(service ? colors.accent : colors.textTertiary)]}
                  >
                    {service || '請選擇'}
                  </Text>
                  <Image
                    systemName="chevron.up.chevron.down"
                    size={12}
                    color={colors.textTertiary}
                  />
                </HStack>
              }
            >
              <Picker
                label="活動"
                selection={service || null}
                onSelectionChange={(value) => {
                  if (typeof value === 'string' && value) handleServiceChange(value as ServiceType);
                }}
              >
                {SERVICES.map((s) => (
                  <Text key={s.name} modifiers={[tag(s.name)]}>
                    {s.name}
                  </Text>
                ))}
              </Picker>
            </Menu>
          </HStack>
          {errorText('service')}
        </Section>

        {!service ? null : (
          <>
            {isSpecial ? (
              <Section title="特別事項">
                <TextField placeholder="輸入特別事項內容" text={notesText} axis="vertical" />
              </Section>
            ) : (
              <Section title="顧客">
                <HStack spacing={10}>
                  <Image systemName="person.fill" size={15} color={colors.textSecondary} />
                  <TextField
                    placeholder="輸入姓名搜尋或新增"
                    text={customerNameText}
                    onTextChange={(text) => {
                      setCustomerQuery(text);
                      clearError('customerName');
                    }}
                  />
                </HStack>
                {errorText('customerName')}
                {knownCustomer?.phone ? (
                  <LabeledContent label="電話">
                    <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
                      {formatPhone(knownCustomer.phone)}
                    </Text>
                  </LabeledContent>
                ) : null}
                {suggestions.map((c) => (
                  <Button
                    key={c.id || c.name}
                    onPress={() => {
                      customerNameText.set(c.name);
                      setCustomerQuery(c.name);
                      clearError('customerName');
                    }}
                    modifiers={[buttonStyle('plain')]}
                  >
                    <HStack spacing={10} modifiers={[contentShape(shapes.rectangle())]}>
                      <Image systemName="person.crop.circle.fill" size={26} color={colors.accent} />
                      <VStack spacing={2} alignment="leading">
                        <Text>{c.name}</Text>
                        {c.phone ? (
                          <Text
                            modifiers={[
                              font({ size: 12 }),
                              foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                            ]}
                          >
                            {formatPhone(c.phone)}
                          </Text>
                        ) : null}
                      </VStack>
                      <Spacer />
                    </HStack>
                  </Button>
                ))}
              </Section>
            )}

            <Section title="時間">
              {/* Compact SwiftUI picker. Its calendar popover doesn't close on a
                  pick, so a new id per date rebuilds the picker, which dismisses it. */}
              <DatePicker
                key={date}
                title="日期"
                selection={isoToDate(date)}
                displayedComponents={['date']}
                onDateChange={(d) => {
                  setDate(dateToIso(d));
                  clearError('date');
                }}
                modifiers={[datePickerStyle('compact'), id(date), ...PICKER_LOOK]}
              />
              {errorText('date')}

              <DatePicker
                title="開始"
                selection={timeToDate(time)}
                displayedComponents={['hourAndMinute']}
                modifiers={PICKER_LOOK}
                onDateChange={(d) => {
                  const value = dateToTime(d);
                  setTime(value);
                  clearError('time');
                  // An end time now before the start has to be picked again
                  if (isSpecial && validEndTime && endTimeInput < value) setEndTimeInput('');
                }}
              />
              {errorText('time')}

              {isSpecial ? (
                <DatePicker
                  title="完結"
                  selection={timeToDate(endTimeInput || time)}
                  displayedComponents={['hourAndMinute']}
                  modifiers={PICKER_LOOK}
                  onDateChange={(d) => {
                    setEndTimeInput(dateToTime(d));
                    clearError('endTime');
                  }}
                />
              ) : endTime ? (
                <PlaceholderRow label="完結" text={`${endTime}（${duration} 分鐘）`} />
              ) : null}
              {endTimeError ? (
                <Text modifiers={[font({ size: 13 }), foregroundStyle(colors.danger)]}>
                  {endTimeError}
                </Text>
              ) : null}

              {clashes.length > 0 ? (
                <VStack spacing={4} alignment="leading">
                  <Label
                    title={`與 ${clashes.length} 個預約時間重疊`}
                    systemImage="exclamationmark.triangle.fill"
                    modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(colors.danger)]}
                  />
                  {clashes.map((apt) => (
                    <Text
                      key={apt.id}
                      modifiers={[
                        font({ size: 13 }),
                        foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                      ]}
                    >
                      {apt.time}
                      {apt.endTime ? `–${apt.endTime}` : ''} {appointmentTitle(apt)}
                    </Text>
                  ))}
                </VStack>
              ) : null}
            </Section>

            {isSpecial ? null : (
              <>
                <Section
                  title="詳情"
                  footer={
                    topUpHint ? (
                      <Text modifiers={[foregroundStyle(colors.danger)]}>{topUpHint}</Text>
                    ) : undefined
                  }
                >
                  {usesHandOrFoot(service) ? (
                    <LabeledContent label="手/腳">
                      <Picker
                        label="手/腳"
                        selection={handOrFoot || null}
                        onSelectionChange={(value) => {
                          if (typeof value === 'string') setHandOrFoot(value as HandOrFoot);
                        }}
                        modifiers={[pickerStyle('segmented'), labelsHidden(), frame({ width: 180 })]}
                      >
                        {HAND_OR_FOOT_OPTIONS.map((option) => (
                          <Text key={option} modifiers={[tag(option)]}>
                            {option}
                          </Text>
                        ))}
                      </Picker>
                    </LabeledContent>
                  ) : null}
                  {showNailExtras ? (
                    <LabeledContent label="複雜款">
                      <Picker
                        label="複雜款"
                        selection={complexDesign}
                        onSelectionChange={(value) => {
                          if (typeof value === 'string') setComplexDesign(toComplexDesign(value));
                        }}
                        modifiers={[pickerStyle('segmented'), labelsHidden(), frame({ width: 240 })]}
                      >
                        {COMPLEX_DESIGN_OPTIONS.map((option) => (
                          <Text key={option} modifiers={[tag(option)]}>
                            {option}
                          </Text>
                        ))}
                      </Picker>
                    </LabeledContent>
                  ) : null}
                  {showNailExtras
                    ? NAIL_EXTRAS.map(({ key, label }) => (
                        <Toggle
                          key={key}
                          label={label}
                          isOn={nailExtras[key]}
                          onIsOnChange={(isOn) => setNailExtra(key, isOn)}
                          modifiers={[tint(colors.accent)]}
                        />
                      ))
                    : null}
                  {usesDeposit(service) ? (
                    <Toggle
                      label="已付訂金"
                      isOn={deposit}
                      onIsOnChange={setDeposit}
                      modifiers={[tint(colors.accent)]}
                    />
                  ) : null}
                  {editing ? (
                    <LabeledContent label="狀態">
                      <Picker
                        label="狀態"
                        selection={status || '預約'}
                        onSelectionChange={(value) => {
                          if (typeof value === 'string') setStatus(value);
                        }}
                        modifiers={[pickerStyle('segmented'), labelsHidden(), frame({ width: 180 })]}
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <Text key={option} modifiers={[tag(option)]}>
                            {option}
                          </Text>
                        ))}
                      </Picker>
                    </LabeledContent>
                  ) : null}
                  <LabeledContent label="收費">
                    <HStack spacing={4}>
                      <Text
                        modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}
                      >
                        $
                      </Text>
                      <TextField
                        placeholder="選填"
                        text={priceTextState}
                        onTextChange={() => {
                          setPriceEdited(true);
                          clearError('price');
                        }}
                        modifiers={[
                          keyboardType('ascii-capable-number-pad'),
                          multilineTextAlignment('trailing'),
                          frame({ width: 100 }),
                        ]}
                      />
                    </HStack>
                  </LabeledContent>
                  {errorText('price')}
                </Section>

                <Section title="備注">
                  <TextField placeholder="備注（選填）" text={notesText} axis="vertical" />
                </Section>
              </>
            )}
          </>
        )}

        {children}
      </Form>
    </SwiftModal>
  );
}

/** A read-only row in the same layout as a picker: label left, value or hint right. */
function PlaceholderRow({ label, text }: { label: string; text: string }) {
  return (
    <LabeledContent label={label}>
      <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
        {text}
      </Text>
    </LabeledContent>
  );
}

/** The next half hour from now, kept within opening hours (09:00–20:30). */
function defaultStartTime(): string {
  const now = new Date();
  const next = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30;
  return minutesToTime(Math.min(Math.max(next, 9 * 60), 20 * 60 + 30));
}

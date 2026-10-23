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
  useNativeState,
  VStack,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  contentShape,
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
} from '@expo/ui/swift-ui/modifiers';
import { useMemo, useState, type ReactNode } from 'react';

import {
  defaultDurationFor,
  defaultPriceFor,
  HAND_OR_FOOT_OPTIONS,
  SERVICES,
  serviceColor,
  type HandOrFoot,
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
import { minutesToTime, timeToMinutes } from '@/utils/dates';
import { formatDateHeader } from '@/utils/groupByDate';
import { formatPhone } from '@/utils/phone';

import { dateToIso, dateToTime, isoToDate, timeToDate } from './dateIso';
import { SwiftModal } from './SwiftModal';

type Field = 'service' | 'customerName' | 'date' | 'time' | 'endTime' | 'price';

const SPECIAL: ServiceType = '特別事項';
const STATUS_OPTIONS = ['預約', '已完成'] as const;
const TIME_SLOTS = buildTimeSlots();

function priceText(service: ServiceType | ''): string {
  if (!service) return '';
  const price = defaultPriceFor(service);
  return price == null ? '' : String(price);
}

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
  const [customerQuery, setCustomerQuery] = useState(
    editing?.customerName ?? params.customerName ?? ''
  );
  const [date, setDate] = useState(editing?.date ?? params.date ?? '');
  const [time, setTime] = useState(editing?.time ?? '');
  const [endTimeInput, setEndTimeInput] = useState(editing?.endTime ?? '');
  const [handOrFoot, setHandOrFoot] = useState<HandOrFoot>(
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
        ? defaultDurationFor(service)
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
    if (!priceEdited) priceTextState.set(priceText(next));
  };

  const validate = (): Partial<Record<Field, string>> => {
    const next: Partial<Record<Field, string>> = {};
    if (!service) next.service = '請選擇活動';
    if (!isSpecial && !customerNameText.get().trim()) next.customerName = '請輸入顧客姓名';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) next.date = '請選擇日期';
    if (!time) next.time = '請選擇時間';
    else if (!validTime) next.time = '時間格式請用 HH:mm';
    if (isSpecial) {
      if (!endTimeInput) next.endTime = '請選擇完結時間';
      else if (!validEndTime) next.endTime = '時間格式請用 HH:mm';
      else if (specialDuration != null && specialDuration < 0)
        next.endTime = '完結時間不可早於開始時間';
    } else if (priceTextState.get().trim() && !/^\d+$/.test(priceTextState.get().trim())) {
      next.price = '收費請只輸入數字';
    }
    return next;
  };

  const handleSubmit = async () => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0 || !service) return;

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
            durationMinutes: duration,
            handOrFoot,
            price: price.trim() ? Number(price.trim()) : undefined,
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

  const clashes =
    !isSpecial && validTime && duration
      ? otherBookings.filter((apt) => {
          const start = timeToMinutes(apt.time);
          const end = apt.endTime
            ? timeToMinutes(apt.endTime)
            : start + (apt.durationMinutes ?? 30);
          const mineStart = timeToMinutes(time);
          const mineEnd = mineStart + duration;
          return mineStart < end && mineEnd > start;
        })
      : [];
  const knownCustomer = customers.find((c) => c.name === customerQuery.trim());

  const errorText = (field: Field) =>
    errors[field] ? (
      <Text modifiers={[font({ size: 13 }), foregroundStyle(colors.danger)]}>{errors[field]}</Text>
    ) : null;

  return (
    <SwiftModal
      onClose={onClose}
      onSave={() => void handleSubmit()}
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
              <DatePicker
                title="日期"
                selection={date ? isoToDate(date) : new Date()}
                displayedComponents={['date']}
                onDateChange={(d) => {
                  setDate(dateToIso(d));
                  clearError('date');
                }}
              />
              {errorText('date')}

              {date ? (
                <Picker
                  label="開始"
                  selection={time || null}
                  onSelectionChange={(value) => {
                    if (typeof value !== 'string') return;
                    setTime(value);
                    clearError('time');
                    if (isSpecial && validEndTime && endTimeInput < value) setEndTimeInput('');
                  }}
                  modifiers={[pickerStyle('menu')]}
                >
                  {TIME_SLOTS.map((slot) => (
                    <Text key={slot} modifiers={[tag(slot)]}>
                      {slot}
                    </Text>
                  ))}
                </Picker>
              ) : (
                <PlaceholderRow label="開始" text="先揀日期" />
              )}
              {errorText('time')}

              {isSpecial ? (
                time ? (
                  <DatePicker
                    title="完結"
                    selection={endTimeInput ? timeToDate(endTimeInput) : timeToDate(time)}
                    displayedComponents={['hourAndMinute']}
                    onDateChange={(d) => {
                      setEndTimeInput(dateToTime(d));
                      clearError('endTime');
                    }}
                  />
                ) : (
                  <PlaceholderRow label="完結" text="先揀開始時間" />
                )
              ) : endTime ? (
                <PlaceholderRow label="完結" text={`${endTime}（${duration} 分鐘）`} />
              ) : null}
              {errorText('endTime')}

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
                <Section title="詳情">
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

function buildTimeSlots(): string[] {
  const slots: string[] = [];
  for (let minutes = 9 * 60; minutes <= 20 * 60 + 30; minutes += 30) {
    const h = String(Math.floor(minutes / 60)).padStart(2, '0');
    const m = String(minutes % 60).padStart(2, '0');
    slots.push(`${h}:${m}`);
  }
  return slots;
}

/**
 * Add / Edit Appointment — SwiftUI Form. create/update API unchanged.
 */
import {
  Button,
  DatePicker,
  Form,
  Picker,
  Section,
  Text,
  TextField,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  controlSize,
  font,
  foregroundStyle,
  pickerStyle,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

import { dateToIso, dateToTime, isoToDate, timeToDate } from '@/components/swiftui/dateIso';
import { SwiftHost } from '@/components/swiftui/SwiftHost';
import { SwiftStateView } from '@/components/swiftui/SwiftStateView';
import {
  defaultDurationFor,
  defaultPriceFor,
  HAND_OR_FOOT_OPTIONS,
  SERVICES,
  type HandOrFoot,
} from '@/constants/services';
import { colors } from '@/constants/theme';
import { findCachedAppointment, useAppointments } from '@/hooks/useAppointments';
import { useCustomers } from '@/hooks/useCustomers';
import {
  createAppointment,
  isUsingMockApi,
  updateAppointment,
} from '@/services/appointmentsApi';
import type { ServiceType } from '@/types/appointment';
import { showAlert } from '@/utils/alert';
import { minutesToTime, timeToMinutes } from '@/utils/dates';
import { formatDateHeader } from '@/utils/groupByDate';

type Field = 'service' | 'customerName' | 'date' | 'time' | 'endTime' | 'price';

const SPECIAL: ServiceType = '特別事項';
const STATUS_OPTIONS = ['預約', '已完成'] as const;
const TIME_SLOTS = buildTimeSlots();

function priceText(service: ServiceType | ''): string {
  if (!service) return '';
  const price = defaultPriceFor(service);
  return price == null ? '' : String(price);
}

export default function AddAppointmentScreen() {
  const params = useLocalSearchParams<{ id?: string; date?: string; customerName?: string }>();
  const [editing] = useState(() => (params.id ? findCachedAppointment(params.id) : undefined));

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

  if (params.id && !editing) {
    return (
      <SwiftStateView
        title="找不到此預約"
        message="請返回時間表，再揀選要修改的預約。"
        action={{
          label: '返回',
          onPress: () => (router.canGoBack() ? router.back() : router.replace('/')),
        }}
      />
    );
  }

  const clashNote =
    validTime && duration
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

  return (
    <SwiftHost>
      <Form>
        <Section title="活動">
          <Picker
            label="選擇活動"
            selection={service || null}
            onSelectionChange={(value) => {
              if (typeof value === 'string' && value) handleServiceChange(value as ServiceType);
            }}
            modifiers={[pickerStyle('menu')]}
          >
            {SERVICES.map((s) => (
              <Text key={s.name} modifiers={[tag(s.name)]}>
                {s.name}
              </Text>
            ))}
          </Picker>
          {errors.service ? (
            <Text modifiers={[font({ size: 13 }), tint(colors.danger)]}>{errors.service}</Text>
          ) : null}
        </Section>

        {!service ? null : isSpecial ? (
          <>
            <Section title="備注">
              <TextField placeholder="輸入特別事項內容" text={notesText} axis="vertical" />
            </Section>
            <DateTimeSections
              date={date}
              time={time}
              endTimeInput={endTimeInput}
              endTime={endTime}
              duration={duration}
              errors={errors}
              showEndTime
              onDateChange={(d) => {
                setDate(d);
                clearError('date');
              }}
              onTimeChange={(t) => {
                setTime(t);
                clearError('time');
                if (HHMM.test(t) && validEndTime && endTimeInput < t) setEndTimeInput('');
              }}
              onEndTimeChange={(t) => {
                setEndTimeInput(t);
                clearError('endTime');
              }}
            />
          </>
        ) : (
          <>
            <Section title="顧客">
              <TextField
                placeholder="輸入姓名搜尋或新增"
                text={customerNameText}
                onTextChange={(text) => {
                  setCustomerQuery(text);
                  clearError('customerName');
                }}
              />
              {errors.customerName ? (
                <Text modifiers={[font({ size: 13 }), tint(colors.danger)]}>
                  {errors.customerName}
                </Text>
              ) : null}
              {suggestions.map((c) => (
                <Button
                  key={c.id || c.name}
                  label={c.phone ? `${c.name} · ${c.phone}` : c.name}
                  onPress={() => {
                    customerNameText.set(c.name);
                    setCustomerQuery(c.name);
                    clearError('customerName');
                  }}
                  modifiers={[buttonStyle('plain')]}
                />
              ))}
            </Section>

            <DateTimeSections
              date={date}
              time={time}
              endTimeInput={endTimeInput}
              endTime={endTime}
              duration={duration}
              errors={errors}
              onDateChange={(d) => {
                setDate(d);
                clearError('date');
              }}
              onTimeChange={(t) => {
                setTime(t);
                clearError('time');
              }}
            />

            {clashNote.length > 0 ? (
              <Section>
                <Text modifiers={[font({ size: 13 }), tint(colors.danger)]}>
                  此時段可能與 {clashNote.length} 個預約重疊
                </Text>
              </Section>
            ) : null}

            <Section title="手/腳">
              <Picker
                label="手/腳"
                selection={handOrFoot || null}
                onSelectionChange={(value) => {
                  if (typeof value === 'string') setHandOrFoot(value as HandOrFoot);
                }}
                modifiers={[pickerStyle('segmented')]}
              >
                {HAND_OR_FOOT_OPTIONS.map((option) => (
                  <Text key={option} modifiers={[tag(option)]}>
                    {option}
                  </Text>
                ))}
              </Picker>
            </Section>

            {editing ? (
              <Section title="狀態">
                <Picker
                  label="狀態"
                  selection={status || '預約'}
                  onSelectionChange={(value) => {
                    if (typeof value === 'string') setStatus(value);
                  }}
                  modifiers={[pickerStyle('segmented')]}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <Text key={option} modifiers={[tag(option)]}>
                      {option}
                    </Text>
                  ))}
                </Picker>
              </Section>
            ) : null}

            <Section title="收費及備注">
              <TextField
                placeholder="收費（可選填）"
                text={priceTextState}
                onTextChange={() => {
                  setPriceEdited(true);
                  clearError('price');
                }}
              />
              {errors.price ? (
                <Text modifiers={[font({ size: 13 }), tint(colors.danger)]}>{errors.price}</Text>
              ) : null}
              <TextField placeholder="備注（可選填）" text={notesText} axis="vertical" />
            </Section>
          </>
        )}

        {service ? (
          <Section
            footer={
              <Text
                modifiers={[
                  font({ size: 12 }),
                  foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                ]}
              >
                {date && validTime
                  ? `${formatDateHeader(date)} ${time}${endTime ? `–${endTime}` : ''} · ${service}`
                  : service}
              </Text>
            }
          >
            <Button
              label={saving ? '儲存中…' : editing ? '儲存變更' : '儲存預約'}
              onPress={() => void handleSubmit()}
              modifiers={[
                buttonStyle('borderedProminent'),
                controlSize('large'),
                tint(colors.accent),
              ]}
            />
          </Section>
        ) : null}
      </Form>
    </SwiftHost>
  );
}

function DateTimeSections({
  date,
  time,
  endTimeInput,
  endTime,
  duration,
  errors,
  showEndTime,
  onDateChange,
  onTimeChange,
  onEndTimeChange,
}: {
  date: string;
  time: string;
  endTimeInput: string;
  endTime: string | null;
  duration?: number;
  errors: Partial<Record<Field, string>>;
  showEndTime?: boolean;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  onEndTimeChange?: (time: string) => void;
}) {
  return (
    <>
      <Section title="日期">
        <DatePicker
          title="日期"
          selection={date ? isoToDate(date) : new Date()}
          displayedComponents={['date']}
          onDateChange={(d) => onDateChange(dateToIso(d))}
        />
        {errors.date ? (
          <Text modifiers={[font({ size: 13 }), tint(colors.danger)]}>{errors.date}</Text>
        ) : null}
      </Section>

      <Section
        title="時間"
        footer={
          endTime ? (
            <Text>
              {time} – {endTime}（{duration} 分鐘）
            </Text>
          ) : undefined
        }
      >
        {!date ? (
          <Text
            modifiers={[
              foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
            ]}
          >
            先選擇日期，再揀時段
          </Text>
        ) : (
          <Picker
            label="開始時間"
            selection={time || null}
            onSelectionChange={(value) => {
              if (typeof value === 'string') onTimeChange(value);
            }}
            modifiers={[pickerStyle('menu')]}
          >
            {TIME_SLOTS.map((slot) => (
              <Text key={slot} modifiers={[tag(slot)]}>
                {slot}
              </Text>
            ))}
          </Picker>
        )}
        {errors.time ? (
          <Text modifiers={[font({ size: 13 }), tint(colors.danger)]}>{errors.time}</Text>
        ) : null}
      </Section>

      {showEndTime ? (
        <Section title="完結時間">
          {!time ? (
            <Text
              modifiers={[
                foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
              ]}
            >
              先選擇時間，再揀完結時間
            </Text>
          ) : (
            <DatePicker
              title="完結時間"
              selection={endTimeInput ? timeToDate(endTimeInput) : timeToDate(time)}
              displayedComponents={['hourAndMinute']}
              onDateChange={(d) => onEndTimeChange?.(dateToTime(d))}
            />
          )}
          {errors.endTime ? (
            <Text modifiers={[font({ size: 13 }), tint(colors.danger)]}>{errors.endTime}</Text>
          ) : null}
        </Section>
      ) : null}
    </>
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

/**
 * State and rules of the add / edit appointment form, shared by the iOS
 * form (components/swiftui/AppointmentForm.tsx) and the Android / web
 * screen (app/add-appointment.tsx), which only differ in how they draw it.
 *
 * Owns what the rules in CLAUDE.md depend on: 活動, 手/腳, the 整甲 add-ons,
 * 訂金, date and times, 狀態, and when 收費 follows its default (or the
 * top-up price). Free-text fields (name, 備注, 收費) stay in the screens,
 * since iOS keeps them in native state; they're passed in to validate and
 * save. The customer name is mirrored here too, for the top-up price and
 * the suggestions.
 */
import { useMemo, useState } from 'react';

import {
  defaultDurationFor,
  defaultPriceFor,
  nailExtrasOf,
  NO_NAIL_EXTRAS,
  showsNailExtras,
  toComplexDesign,
  usesDeposit,
  usesHandOrFoot,
  usesNailExtras,
  type HandOrFoot,
  type NailExtra,
} from '@/constants/services';
import { saveAppointment } from '@/hooks/appointmentWrites';
import { useAppointments } from '@/hooks/useAppointments';
import { useCustomers } from '@/hooks/useCustomers';
import { offerWhatsAppConfirmation } from '@/hooks/whatsAppConfirmation';
import type { Appointment, ServiceType, UpdateAppointmentInput } from '@/types/appointment';
import { showAlert } from '@/utils/alert';
import { addDays, minutesToTime, timeToMinutes } from '@/utils/dates';
import { describeOverlaps, findOverlaps } from '@/utils/overlap';
import { lastSetDate, lastSetHint, topUpPrice as topUpPriceFor, topUpRuleFor } from '@/utils/topUpPrice';

export type FormField = 'service' | 'customerName' | 'date' | 'time' | 'endTime' | 'price';
export type FormErrors = Partial<Record<FormField, string>>;

/** The free-text fields, as the screen holds them. */
export type FormText = { customerName: string; notes: string; price: string };

const SPECIAL: ServiceType = '特別事項';
const HHMM = /^\d{2}:\d{2}$/;
/** Customer suggestions shown under the name field. */
const MAX_SUGGESTIONS = 5;

type Options = {
  /** The appointment to edit; leave out to add a new one. */
  editing?: Appointment;
  /** Starting values for a new appointment. */
  initial: { customerName?: string; date: string; time: string; status: string };
  /**
   * Whether 特別事項 needs 完結時間. iOS lets it be blank, which saves as the
   * start time; Android / web ask for it.
   */
  requireSpecialEndTime: boolean;
};

export function useAppointmentForm({ editing, initial, requireSpecialEndTime }: Options) {
  // Old rows may hold services / 手腳 values not in the lists; they're kept as-is
  const [service, setService] = useState<ServiceType | ''>(
    (editing?.service as ServiceType | undefined) ?? ''
  );
  const [customerName, setCustomerName] = useState(
    editing?.customerName ?? initial.customerName ?? ''
  );
  const [date, setDate] = useState(editing?.date ?? initial.date);
  const [time, setTime] = useState(editing?.time ?? initial.time);
  // Only used by 特別事項, where it's picked rather than derived from the service
  const [endTimeInput, setEndTimeInput] = useState(editing?.endTime ?? '');
  const [handOrFoot, setHandOrFoot] = useState<HandOrFoot>(
    (editing?.handOrFoot as HandOrFoot | undefined) ?? (editing ? ('' as HandOrFoot) : '手')
  );
  // New bookings start on paid; older rows without a 訂金 value read as unpaid
  const [deposit, setDeposit] = useState(editing ? (editing.deposit ?? false) : true);
  const [complexDesign, setComplexDesign] = useState(() =>
    toComplexDesign(editing?.complexDesign)
  );
  const [nailExtras, setNailExtras] = useState(() => nailExtrasOf(editing));
  const setNailExtra = (key: NailExtra, on: boolean) => {
    setNailExtras((prev) => ({ ...prev, [key]: on }));
  };
  // Once 收費 is typed by hand, nothing else overwrites it
  const [priceEdited, setPriceEdited] = useState(false);
  const [status, setStatus] = useState(editing?.status ?? initial.status);
  const [errors, setErrors] = useState<FormErrors>({});

  const { customers } = useCustomers();
  const dayBookings = useAppointments({ from: date, to: date }, { enabled: date !== '' });
  // The booking being edited shouldn't clash with itself
  const otherBookings = useMemo(
    () => dayBookings.appointments.filter((apt) => apt.id !== editing?.id),
    [dayBookings.appointments, editing]
  );

  const isSpecial = service === SPECIAL;
  const showNailExtras = showsNailExtras(service, handOrFoot);
  // Hidden add-ons are saved cleared, so a booking switched to 腳 drops them
  const appliedNailExtras = showNailExtras ? { complexDesign, ...nailExtras } : NO_NAIL_EXTRAS;

  // 補眼睫毛 / 補甲: once a known customer is picked, 收費 follows their last set
  const topUp = topUpRuleFor(service);
  const isTopUp = topUp != null;
  const knownCustomer = customers.find((c) => c.name === customerName.trim());
  const setHistory = useAppointments(
    { from: date && addDays(date, -(topUp?.lookbackDays ?? 0)), to: date },
    { enabled: isTopUp && knownCustomer != null && date !== '' }
  );
  const topUpReady =
    topUp != null &&
    knownCustomer != null &&
    date !== '' &&
    !setHistory.loading &&
    !setHistory.error;
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
  // Edits keep the sheet's 收費 until something the price depends on changes,
  // then follow the same rules as a new booking
  const priceKey = [
    service,
    handOrFoot,
    appliedNailExtras.complexDesign,
    appliedNailExtras.removal,
    appliedNailExtras.extension,
    isTopUp ? customerName.trim() : '',
    isTopUp ? date : '',
  ].join('|');
  const [openedPriceKey] = useState(priceKey);
  const [keepSheetPrice, setKeepSheetPrice] = useState(editing != null);
  if (keepSheetPrice && priceKey !== openedPriceKey) setKeepSheetPrice(false);
  /** Whether the screen should show autoPrice in 收費 (when it's defined). */
  const followAutoPrice = !priceEdited && !keepSheetPrice;

  const validTime = HHMM.test(time);
  const validEndTime = HHMM.test(endTimeInput);
  // 特別事項: Duration = End Time − 時間 (none when they're equal)
  const specialDuration =
    validTime && validEndTime ? timeToMinutes(endTimeInput) - timeToMinutes(time) : undefined;
  const endBeforeStart = specialDuration != null && specialDuration < 0;
  // 特別事項 runs to its End Time; everything else (edits too) takes the
  // length from the service, 手/腳 and add-ons, so an older row whose
  // Duration left out its add-ons is saved with the full length
  const duration = isSpecial
    ? specialDuration && specialDuration > 0
      ? specialDuration
      : undefined
    : service
      ? defaultDurationFor(service, { handOrFoot, ...appliedNailExtras })
      : undefined;
  const endTime = validTime && duration ? minutesToTime(timeToMinutes(time) + duration) : null;
  // Shown as soon as 完結 is before 開始, not only on save
  const endTimeError =
    errors.endTime ?? (isSpecial && endBeforeStart ? '完結時間不可早於開始時間' : undefined);
  // Only once the range is valid; saving asks to confirm these
  const clashes =
    validTime && !(isSpecial && endBeforeStart) ? findOverlaps(otherBookings, time, duration) : [];

  const suggestions = useMemo(() => {
    const q = customerName.trim().toLowerCase();
    if (!q) return [];
    if (customers.some((c) => c.name.toLowerCase() === q)) return [];
    return customers.filter((c) => c.name.toLowerCase().includes(q)).slice(0, MAX_SUGGESTIONS);
  }, [customers, customerName]);

  const clearError = (field: FormField) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const changeService = (next: ServiceType) => {
    setService(next);
    // A new 整甲 or 整甲 + 眼睫毛 usually includes 拆甲
    if (!editing) setNailExtra('removal', next === '整甲' || next === '整甲 + 眼睫毛');
    clearError('service');
  };

  const validate = (text: FormText): FormErrors => {
    const next: FormErrors = {};
    if (!service) next.service = '請選擇活動';
    if (!isSpecial && !text.customerName.trim()) next.customerName = '請輸入顧客姓名';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) next.date = '請選擇日期';
    if (!time) next.time = '請選擇開始時間';
    else if (!validTime) next.time = '時間格式請用 HH:mm（例如 14:30）';
    if (isSpecial) {
      if (!endTimeInput) {
        if (requireSpecialEndTime) next.endTime = '請選擇完結時間';
      } else if (!validEndTime) {
        next.endTime = '時間格式請用 HH:mm（例如 14:30）';
      } else if (endBeforeStart) {
        next.endTime = '完結時間不可早於開始時間';
      }
    } else if (text.price.trim() && !/^\d+$/.test(text.price.trim())) {
      next.price = '收費請只輸入數字';
    }
    return next;
  };

  const toInput = (text: FormText, chosen: ServiceType): UpdateAppointmentInput => {
    // 特別事項 rows have no customer, 手/腳, 收費 or 狀態, and View repeats 備注
    const input = isSpecial
      ? {
          customerName: '',
          date,
          time,
          service: chosen,
          notes: text.notes,
          view: text.notes,
          durationMinutes: duration,
        }
      : {
          customerName: text.customerName,
          date,
          time,
          service: chosen,
          notes: text.notes,
          durationMinutes: duration,
          handOrFoot: usesHandOrFoot(chosen) ? handOrFoot : undefined,
          price: text.price.trim() ? Number(text.price.trim()) : undefined,
          // Other services leave 訂金 and the add-ons untouched
          deposit: usesDeposit(chosen) ? deposit : undefined,
          ...(usesNailExtras(chosen) ? appliedNailExtras : {}),
        };
    return editing ? { ...input, status: isSpecial ? '' : status } : input;
  };

  /**
   * Validate, confirm any clash, then save (shown at once, sent in the
   * background) and pass the booking as it will be saved to `onSaved`.
   */
  const submit = (text: FormText, onSaved: (saved: Appointment) => void) => {
    const found = validate(text);
    setErrors(found);
    if (Object.keys(found).length > 0 || !service) return;
    const chosen = service;
    const save = () => {
      const saved = saveAppointment(toInput(text, chosen), editing);
      // Once the form has closed, ask about a WhatsApp confirmation
      if (!editing) offerWhatsAppConfirmation(saved);
      onSaved(saved);
    };

    // Overlaps are sometimes intended, so they only need confirming
    const overlaps = findOverlaps(otherBookings, time, duration);
    if (overlaps.length === 0) {
      save();
      return;
    }
    showAlert(
      '時間重疊',
      `此時段與以下預約時間重疊：\n${describeOverlaps(overlaps)}\n\n仍然要儲存嗎？`,
      [
        { text: '返回修改', style: 'cancel' },
        { text: '仍然儲存', onPress: save },
      ]
    );
  };

  return {
    service,
    changeService,
    customerName,
    setCustomerName,
    knownCustomer,
    suggestions,
    customers,
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
    topUp,
    topUpHint,
    isSpecial,
    showNailExtras,
    validTime,
    validEndTime,
    duration,
    endTime,
    endTimeError,
    clashes,
    dayBookings,
    otherBookings,
    errors,
    clearError,
    submit,
  };
}

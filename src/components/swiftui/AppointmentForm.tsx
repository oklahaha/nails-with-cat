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
  Popover,
  Section,
  Spacer,
  Text,
  TextField,
  type TextFieldRef,
  Toggle,
  useNativeState,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  animation,
  Animation,
  background,
  buttonStyle,
  contentShape,
  cornerRadius,
  datePickerStyle,
  environment,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  keyboardType,
  labelsHidden,
  multilineTextAlignment,
  offset,
  padding,
  pickerStyle,
  scrollDismissesKeyboard,
  shapes,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import {
  toComplexDesign,
  usesDeposit,
  usesHandOrFoot,
  HAND_OR_FOOT_OPTIONS,
  COMPLEX_DESIGN_OPTIONS,
  EXTENSION_OPTIONS,
  toExtension,
  NAIL_EXTRAS,
  SERVICES,
  serviceColor,
  type HandOrFoot,
} from '@/constants/services';
import { colors } from '@/constants/theme';
import { useAppointmentForm, type FormField } from '@/hooks/useAppointmentForm';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { SHAKE_STEP_MS, useShake } from '@/hooks/useShake';
import { STATUS_OPTIONS, type Appointment, type ServiceType } from '@/types/appointment';
import { appointmentTitle } from '@/utils/appointmentTitle';
import { formatDuration, isDayPick, minutesToTime, todayIsoDate } from '@/utils/dates';
import { formatPhone } from '@/utils/phone';
import { quoteLabel } from '@/utils/quotes';

import { openPhotoViewer } from '@/utils/appointmentActions';

import { dateToIso, dateToTime, isoToDate, timeToDate } from './dateIso';
import { PhotoSection, THUMB } from './PhotoSection';
import { SwiftModal } from './SwiftModal';

/** Same styling as @expo/ui's DateTimePicker drop-in: accent tint, Chinese month/weekday names. */
const PICKER_LOOK = [tint(colors.accent), environment('locale', 'zh_Hant_HK')];
/** zh_Hant_HK shows 上午/下午; en_GB gives a 24-hour clock (time pickers show only digits). */
const TIME_PICKER_LOOK = [tint(colors.accent), environment('locale', 'en_GB')];
/** Lets a menu or popover finish closing before the next field opens. */
const NEXT_FIELD_DELAY_MS = 400;

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
  const {
    service,
    changeService: handleServiceChange,
    setCustomerName: setCustomerQuery,
    knownCustomer,
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
    referencePhotos,
    keptDepositHint,
    complexDesign,
    setComplexDesign,
    extension,
    setExtension,
    nailExtras,
    setNailExtra,
    status,
    setStatus,
    quotes,
    liveQuotes,
    setQuoteFor,
    setPriceEdited,
    autoPrice,
    followAutoPrice,
    topUpHint,
    isSpecial,
    showNailExtras,
    showReference,
    validEndTime,
    duration,
    endTime,
    endTimeError,
    clashes,
    errors,
    failedSaves,
    clearError,
    submit,
  } = useAppointmentForm({
    editing,
    initial: {
      customerName: params.customerName,
      // Starts on today and the next half hour, since the pickers always show a value
      date: params.date ?? todayIsoDate(),
      time: defaultStartTime(),
      status: '預約',
    },
    // A blank 完結 shows (and saves as) the start time
    requireSpecialEndTime: false,
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  // A picked day turns the date popover into the time wheel: iOS drops a second
  // popover asked for while the first is still closing
  const [calendarShowsTime, setCalendarShowsTime] = useState(false);
  // The first text field after 活動: 顧客 or the 特別事項 text
  const firstFieldRef = useRef<TextFieldRef>(null);
  // One pending auto-advance at a time; opening a picker by hand cancels it
  const nextStep = useRef<ReturnType<typeof setTimeout>>(undefined);
  const cancelNext = () => clearTimeout(nextStep.current);
  const after = (step: () => void) => {
    cancelNext();
    nextStep.current = setTimeout(step, NEXT_FIELD_DELAY_MS);
  };
  useEffect(() => cancelNext, []);
  // Text fields live in native state, read back when saving
  const customerNameText = useNativeState(editing?.customerName ?? params.customerName ?? '');
  const notesText = useNativeState(editing?.notes ?? '');
  const priceTextState = useNativeState(editing?.price != null ? String(editing.price) : '');
  useEffect(() => {
    if (autoPrice != null && followAutoPrice) priceTextState.set(String(autoPrice));
  }, [autoPrice, followAutoPrice, priceTextState]);

  const reduceMotion = useReduceMotion();
  // Changes whenever the form gains or loses rows, which then slide rather than jump
  const rowLayout =
    (SERVICES.findIndex((s) => s.name === service) + 1) * 1000 +
    (showNailExtras ? 100 : 0) +
    clashes.length;

  const handleSubmit = () =>
    submit(
      {
        customerName: customerNameText.get(),
        notes: notesText.get(),
        price: priceTextState.get(),
      },
      onSaved
    );

  const timeWheel = (
    <DatePicker
      title="開始"
      selection={timeToDate(time)}
      displayedComponents={['hourAndMinute']}
      onDateChange={(d) => {
        const value = dateToTime(d);
        setTime(value);
        clearError('time');
        // An end time now before the start has to be picked again
        if (isSpecial && validEndTime && endTimeInput < value) setEndTimeInput('');
      }}
      modifiers={[
        datePickerStyle('wheel'),
        labelsHidden(),
        frame({ width: 240 }),
        padding({ all: 8 }),
        ...TIME_PICKER_LOOK,
      ]}
    />
  );

  // A component, so each shake step re-renders only the message, not the form
  const errorMessage = (message?: string) => (
    <ErrorMessage message={message} failedSaves={failedSaves} />
  );
  const errorText = (field: FormField) => errorMessage(errors[field]);

  // Each photo's 報價 sits right under it, so there's no counting which is which
  const quoteBelow = (path: string, i: number) => (
    <QuoteField
      // Native state reads `initial` once: a reload's new 報價 remounts it (with any typed text kept)
      key={`${path}:${liveQuotes[path] ?? ''}`}
      label={quoteLabel(i)}
      initial={quotes[path] ?? ''}
      onChange={(text) => {
        setQuoteFor(path, text);
        clearError('quote');
      }}
    />
  );

  return (
    <SwiftModal
      onClose={onClose}
      onSave={handleSubmit}
      saveDisabled={!service}
    >
      <Form
        modifiers={[
          scrollDismissesKeyboard('immediately'),
          ...(reduceMotion ? [] : [animation(Animation.snappy({ duration: 0.25 }), rowLayout)]),
        ]}
      >
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
                  if (typeof value !== 'string' || !value) return;
                  handleServiceChange(value as ServiceType);
                  // Walk on to the next field: 活動 → 顧客 → 日期 → 開始
                  after(() => void firstFieldRef.current?.focus());
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
                <TextField
                  ref={firstFieldRef}
                  placeholder="輸入特別事項內容"
                  text={notesText}
                  axis="vertical"
                />
              </Section>
            ) : (
              <Section title="顧客">
                <HStack spacing={10}>
                  <Image systemName="person.fill" size={15} color={colors.textSecondary} />
                  <TextField
                    ref={firstFieldRef}
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
                      void firstFieldRef.current?.blur();
                      after(() => setCalendarOpen(true));
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
              {/* Looks like the compact picker, but the compact picker's own popover
                  can't be closed from JS, so this one opens the same calendar in ours. */}
              <LabeledContent label="日期">
                <Popover
                  isPresented={calendarOpen}
                  onIsPresentedChange={(open) => {
                    setCalendarOpen(open);
                    if (!open) setCalendarShowsTime(false);
                  }}
                >
                  <Popover.Trigger>
                    <Button
                      onPress={() => {
                        cancelNext();
                        setCalendarOpen(true);
                      }}
                      modifiers={[buttonStyle('plain')]}
                    >
                      <Text
                        modifiers={[
                          foregroundStyle(calendarOpen ? colors.accent : colors.text),
                          padding({ horizontal: 11, vertical: 6 }),
                          background(colors.surfaceRaised),
                          cornerRadius(8),
                        ]}
                      >
                        {date.replace(/^(\d+)-0?(\d+)-0?(\d+)$/, '$1年$2月$3日')}
                      </Text>
                    </Button>
                  </Popover.Trigger>
                  <Popover.Content>
                    {calendarShowsTime ? (
                      <VStack spacing={0} modifiers={[padding({ top: 12 })]}>
                        <Text modifiers={[font({ weight: 'semibold' })]}>開始時間</Text>
                        {timeWheel}
                      </VStack>
                    ) : (
                      <DatePicker
                        title="日期"
                        selection={isoToDate(date)}
                        displayedComponents={['date']}
                        onDateChange={(d) => {
                          const picked = dateToIso(d);
                          setDate(picked);
                          clearError('date');
                          // The month/year wheel changes the date too; only a tapped day moves on
                          if (isDayPick(date, picked)) setCalendarShowsTime(true);
                        }}
                        modifiers={[
                          datePickerStyle('graphical'),
                          frame({ width: 320 }),
                          padding({ all: 8 }),
                          ...PICKER_LOOK,
                        ]}
                      />
                    )}
                  </Popover.Content>
                </Popover>
              </LabeledContent>
              {errorText('date')}

              <LabeledContent label="開始">
                <Popover isPresented={timeOpen} onIsPresentedChange={setTimeOpen}>
                  <Popover.Trigger>
                    <Button
                      onPress={() => {
                        cancelNext();
                        setTimeOpen(true);
                      }}
                      modifiers={[buttonStyle('plain')]}
                    >
                      <Text
                        modifiers={[
                          foregroundStyle(timeOpen ? colors.accent : colors.text),
                          padding({ horizontal: 11, vertical: 6 }),
                          background(colors.surfaceRaised),
                          cornerRadius(8),
                        ]}
                      >
                        {time}
                      </Text>
                    </Button>
                  </Popover.Trigger>
                  <Popover.Content>
                    {timeWheel}
                  </Popover.Content>
                </Popover>
              </LabeledContent>
              {errorText('time')}

              {isSpecial ? (
                <DatePicker
                  title="完結"
                  selection={timeToDate(endTimeInput || time)}
                  displayedComponents={['hourAndMinute']}
                  modifiers={TIME_PICKER_LOOK}
                  onDateChange={(d) => {
                    setEndTimeInput(dateToTime(d));
                    clearError('endTime');
                  }}
                />
              ) : endTime ? (
                <PlaceholderRow label="完結" text={`${endTime}（${formatDuration(duration ?? 0)}）`} />
              ) : null}
              {errorMessage(endTimeError)}

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
                {/* Before 詳情: 複雜款 and 收費 are usually decided from this photo */}
                {!showReference ? null : (
                  <PhotoSection
                    kind="reference"
                    paths={referencePhotos.paths}
                    hint={
                      editing
                        ? '加入的相片會即時上傳'
                        : '顧客 WhatsApp 傳來的款式相片，儲存預約後會上傳'
                    }
                    pending={referencePhotos.pending}
                    adding={referencePhotos.adding}
                    canAdd={referencePhotos.canAdd}
                    onAdd={(source) => void referencePhotos.add(source)}
                    onOpen={(path) =>
                      openPhotoViewer({
                        kind: 'reference',
                        start: path,
                        paths: referencePhotos.paths,
                        // A saved booking's photos are removed in the viewer, after a confirm
                        appointmentId: referencePhotos.appointmentId,
                      })
                    }
                    onRemove={referencePhotos.remove}
                    below={quoteBelow}
                  >
                    {errorText('quote')}
                  </PhotoSection>
                )}

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
                  {showNailExtras ? (
                    // 幾隻 adds 30 min / $50, 全手 1 h / $100 (services.ts)
                    <LabeledContent label="延長">
                      <Picker
                        label="延長"
                        selection={extension}
                        onSelectionChange={(value) => {
                          if (typeof value === 'string') setExtension(toExtension(value));
                        }}
                        modifiers={[pickerStyle('segmented'), labelsHidden(), frame({ width: 240 })]}
                      >
                        {EXTENSION_OPTIONS.map((option) => (
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
                  {usesDeposit(service) && keptDepositHint ? (
                    <Text modifiers={[font({ size: 13 }), foregroundStyle(colors.accent)]}>
                      {keptDepositHint}
                    </Text>
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

                {editing ? (
                  <Section>
                    <LabeledContent label="狀態">
                      <Picker
                        label="狀態"
                        selection={status || '預約'}
                        onSelectionChange={(value) => {
                          if (typeof value === 'string') setStatus(value);
                        }}
                        modifiers={[pickerStyle('segmented'), labelsHidden(), frame({ width: 240 })]}
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <Text key={option} modifiers={[tag(option)]}>
                            {option}
                          </Text>
                        ))}
                      </Picker>
                    </LabeledContent>
                  </Section>
                ) : null}
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

/** A photo's 報價, under its thumbnail; its text lives in native state, sent up as typed. */
function QuoteField({
  label,
  initial,
  onChange,
}: {
  label: string;
  initial: string;
  onChange: (text: string) => void;
}) {
  const text = useNativeState(initial);
  return (
    <HStack
      spacing={2}
      modifiers={[
        padding({ horizontal: 8, vertical: 6 }),
        frame({ width: THUMB }),
        background(colors.surfaceRaised),
        cornerRadius(8),
      ]}
    >
      <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>$</Text>
      <TextField
        placeholder="報價"
        text={text}
        onTextChange={onChange}
        modifiers={[keyboardType('ascii-capable-number-pad'), accessibilityLabel(label)]}
      />
    </HStack>
  );
}

/** A form error that shakes on each failed save. */
function ErrorMessage({ message, failedSaves }: { message?: string; failedSaves: number }) {
  const shakeX = useShake(failedSaves, Boolean(message));
  return message ? (
    <Text
      modifiers={[
        font({ size: 13 }),
        foregroundStyle(colors.danger),
        offset({ x: shakeX }),
        animation(Animation.linear({ duration: SHAKE_STEP_MS / 1000 }), shakeX),
      ]}
    >
      {message}
    </Text>
  ) : null;
}

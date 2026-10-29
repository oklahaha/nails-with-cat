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
import { useEffect, type ReactNode } from 'react';

import {
  toComplexDesign,
  usesDeposit,
  usesHandOrFoot,
  HAND_OR_FOOT_OPTIONS,
  COMPLEX_DESIGN_OPTIONS,
  NAIL_EXTRAS,
  SERVICES,
  serviceColor,
  type HandOrFoot,
} from '@/constants/services';
import { colors } from '@/constants/theme';
import { useAppointmentForm, type FormField } from '@/hooks/useAppointmentForm';
import { STATUS_OPTIONS, type Appointment, type ServiceType } from '@/types/appointment';
import { appointmentTitle } from '@/utils/appointmentTitle';
import { formatDuration, minutesToTime, todayIsoDate } from '@/utils/dates';
import { formatPhone } from '@/utils/phone';

import { dateToIso, dateToTime, isoToDate, timeToDate } from './dateIso';
import { SwiftModal } from './SwiftModal';

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
    validEndTime,
    duration,
    endTime,
    endTimeError,
    clashes,
    errors,
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
  // Text fields live in native state, read back when saving
  const customerNameText = useNativeState(editing?.customerName ?? params.customerName ?? '');
  const notesText = useNativeState(editing?.notes ?? '');
  const priceTextState = useNativeState(editing?.price != null ? String(editing.price) : '');
  useEffect(() => {
    if (autoPrice != null && followAutoPrice) priceTextState.set(String(autoPrice));
  }, [autoPrice, followAutoPrice, priceTextState]);

  const handleSubmit = () =>
    submit(
      {
        customerName: customerNameText.get(),
        notes: notesText.get(),
        price: priceTextState.get(),
      },
      onSaved
    );

  const errorText = (field: FormField) =>
    errors[field] ? (
      <Text modifiers={[font({ size: 13 }), foregroundStyle(colors.danger)]}>{errors[field]}</Text>
    ) : null;

  return (
    <SwiftModal
      onClose={onClose}
      onSave={handleSubmit}
      saveDisabled={!service}
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
                <PlaceholderRow label="完結" text={`${endTime}（${formatDuration(duration ?? 0)}）`} />
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

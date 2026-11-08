/**
 * 今日預約 home screen widget (iOS): today's booking count and the next
 * upcoming booking, in small and medium sizes, plus the lock screen sizes
 * (circular: the count; rectangular: the next booking; inline: one line).
 *
 * How the widget gets its data:
 * - The widget can't fetch anything itself. The `'widget'` component below is
 *   compiled into a separate bundle that runs inside the widget extension,
 *   with no network, no app state, and no access to anything outside the
 *   function body (so colours are declared inside it).
 * - The app pushes the data instead: `useUpcomingSync` loads the next two
 *   weeks from Apps Script, `buildTodayWidgetTimeline` turns them into
 *   timeline entries, and `TodayWidget.updateTimeline` saves them to the shared
 *   app group, where iOS reads them.
 * - Each entry is the props for one moment: midnight of each day (new count)
 *   and the start of each booking (next one moves on). iOS swaps entries at
 *   those times, so the widget stays right for a week without the app open.
 *
 * This file is also the widget's `initialLayout` in app.json, so it must stay
 * self-contained: no imports from the app (types are fine, they're erased).
 */
import {
  AccessoryWidgetBackground,
  Capsule,
  HStack,
  Spacer,
  Text,
  VStack,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  padding,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type TodayWidgetAppointment = {
  /** HH:mm */
  time: string;
  /** Customer name (see appointmentTitle) */
  title: string;
  service: string;
  /** Service colour from serviceColor() */
  color: string;
};

export type TodayWidgetProps = {
  /** e.g. 10月26日（一）; empty until the app has synced once */
  dateLabel: string;
  todayCount: number;
  /**
   * The first booking after this entry's time, today or a later day. Left
   * out, never null, when there's none: the props are saved to UserDefaults,
   * which throws on null and stops the app at startup.
   */
  next?: TodayWidgetAppointment & {
    /** Empty when it's today, else 明天 or e.g. 10月28日（三） */
    dayLabel: string;
  };
  /** Bookings later today after `next`, for the medium size (at most 2) */
  laterToday: TodayWidgetAppointment[];
};

const TodayWidgetView = (props: TodayWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  // Mirrors src/constants/theme.ts, which the widget bundle can't import
  const background = '#151312';
  const text = '#F4EFEB';
  const textSecondary = '#A39890';
  const textTertiary = '#6E655F';
  const accent = '#EC958C';

  const isMedium = environment.widgetFamily === 'systemMedium';
  const next = props.next;

  // Tapping the widget opens the timetable
  const container = [containerBackground(background, 'widget'), widgetURL('nailswithcat:///')];

  // Lock screen sizes: iOS draws these monochrome and hides the background
  // (still required, or iOS 17+ shows its placeholder), so no colours
  const family = environment.widgetFamily;
  if (family === 'accessoryInline') {
    return (
      <Text modifiers={container}>
        {!props.dateLabel
          ? '今日預約'
          : next && !next.dayLabel
            ? `${next.time} ${next.title}`
            : `今日 ${props.todayCount} 個預約`}
      </Text>
    );
  }
  if (family === 'accessoryCircular') {
    return (
      <ZStack modifiers={container}>
        <AccessoryWidgetBackground />
        <VStack spacing={0}>
          <Text
            modifiers={[font({ size: 22, weight: 'bold', design: 'rounded' }), monospacedDigit()]}
          >
            {props.dateLabel ? String(props.todayCount) : '–'}
          </Text>
          <Text modifiers={[font({ size: 10, weight: 'semibold' })]}>預約</Text>
        </VStack>
      </ZStack>
    );
  }
  if (family === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={0} modifiers={container}>
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), lineLimit(1)]}>
          {props.dateLabel ? `今日 ${props.todayCount} 個預約` : '今日預約'}
        </Text>
        <Text modifiers={[font({ size: 15, weight: 'bold' }), lineLimit(1)]}>
          {!props.dateLabel ? '打開 app 載入' : next ? next.title : '沒有預約'}
        </Text>
        {next ? (
          <Text modifiers={[font({ size: 13 }), monospacedDigit(), lineLimit(1)]}>
            {next.dayLabel ? `${next.dayLabel} ${next.time}` : `${next.time} ${next.service}`}
          </Text>
        ) : null}
      </VStack>
    );
  }

  if (!props.dateLabel) {
    return (
      <VStack spacing={4} modifiers={container}>
        <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(text)]}>
          今日預約
        </Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle(textSecondary)]}>
          打開 app 載入預約
        </Text>
      </VStack>
    );
  }

  const summary = (
    <VStack alignment="leading" spacing={0}>
      <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(textSecondary)]}>
        {props.dateLabel}
      </Text>
      <HStack alignment="firstTextBaseline" spacing={4}>
        <Text
          modifiers={[
            font({ size: 44, weight: 'bold', design: 'rounded' }),
            monospacedDigit(),
            foregroundStyle(accent),
          ]}
        >
          {String(props.todayCount)}
        </Text>
        <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(text)]}>
          個預約
        </Text>
      </HStack>
    </VStack>
  );

  const nextBlock = next ? (
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(textTertiary)]}>
        {next.dayLabel ? `下一個 · ${next.dayLabel}` : '下一個'}
      </Text>
      <HStack spacing={6}>
        <Capsule modifiers={[foregroundStyle(next.color), frame({ width: 4, height: 30 })]} />
        <VStack alignment="leading" spacing={1}>
          <Text
            modifiers={[
              font({ size: 15, weight: 'semibold' }),
              foregroundStyle(text),
              lineLimit(1),
            ]}
          >
            {next.title}
          </Text>
          <Text
            modifiers={[
              font({ size: 12 }),
              monospacedDigit(),
              foregroundStyle(textSecondary),
              lineLimit(1),
            ]}
          >
            {`${next.time} ${next.service}`}
          </Text>
        </VStack>
      </HStack>
    </VStack>
  ) : (
    <Text modifiers={[font({ size: 13 }), foregroundStyle(textSecondary)]}>沒有預約</Text>
  );

  if (!isMedium) {
    return (
      <VStack alignment="leading" spacing={0} modifiers={container}>
        <HStack>
          {summary}
          <Spacer />
        </HStack>
        <Spacer />
        <HStack>
          {nextBlock}
          <Spacer />
        </HStack>
      </VStack>
    );
  }

  return (
    <HStack alignment="top" spacing={16} modifiers={container}>
      <VStack alignment="leading" spacing={0}>
        {summary}
        <Spacer />
      </VStack>
      <VStack alignment="leading" spacing={8}>
        {nextBlock}
        {props.laterToday.map((apt, i) => (
          <HStack key={i} spacing={6} modifiers={[padding({ leading: 10 })]}>
            <Text
              modifiers={[
                font({ size: 13, weight: 'semibold' }),
                monospacedDigit(),
                foregroundStyle(textSecondary),
              ]}
            >
              {apt.time}
            </Text>
            <Text modifiers={[font({ size: 13 }), foregroundStyle(text), lineLimit(1)]}>
              {apt.title}
            </Text>
          </HStack>
        ))}
        <Spacer />
      </VStack>
      <Spacer />
    </HStack>
  );
};

const TodayWidget = createWidget<TodayWidgetProps>('TodayWidget', TodayWidgetView, {
  dateLabel: '',
  todayCount: 0,
  laterToday: [],
});

export default TodayWidget;

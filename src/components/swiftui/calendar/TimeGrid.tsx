/**
 * Day / Week time grid (iOS). Overlapping appointments share the column side
 * by side. It opens scrolled to now or the first booking, so give each page
 * of days its own `key`.
 */
import {
  Button,
  Circle,
  HStack,
  Rectangle,
  ScrollView,
  Spacer,
  Text,
  useNativeState,
  VStack,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  background,
  buttonStyle,
  clipShape,
  contentShape,
  font,
  foregroundStyle,
  frame,
  id,
  lineLimit,
  monospacedDigit,
  offset,
  onAppear,
  opacity,
  padding,
  scrollPosition,
  scrollTargetLayout,
  shapes,
} from '@expo/ui/swift-ui/modifiers';

import { firstVisibleHour, layoutBlocks } from '@/components/calendar/layoutBlocks';
import { colors, spacing } from '@/constants/theme';
import { useNow } from '@/hooks/useNow';
import type { Appointment } from '@/types/appointment';
import { parseIsoDate, toIsoDate, WEEKDAY_LABELS } from '@/utils/dates';

import { useHideTabBarOnScrollModifiers } from '../hideTabBarOnScroll';
import { Hairline } from './Hairline';
import { TimeGridBlock } from './TimeGridBlock';

const HOUR_HEIGHT = 56;
const LABEL_WIDTH = 44;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const GRID_HEIGHT = HOURS.length * HOUR_HEIGHT;
/** Shortest block drawn, so it stays tappable. */
const MIN_BLOCK_HEIGHT = 18;

const toY = (minutes: number) => (minutes / 60) * HOUR_HEIGHT;
const clock = (hours: number, minutes = 0) =>
  `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

type Props = {
  /** One date for the Day view, seven for the Week view. */
  days: string[];
  byDate: Map<string, Appointment[]>;
  onPressAppointment: (appointment: Appointment) => void;
  /** Week view: tap a column header to open that day. */
  onPressDay?: (date: string) => void;
};

export function TimeGrid({ days, byDate, onPressAppointment, onPressDay }: Props) {
  const hideTabBarOnScroll = useHideTabBarOnScrollModifiers();
  const compact = days.length > 1;
  const now = useNow();
  const today = toIsoDate(now);
  const blocksByDay = days.map((date) => layoutBlocks(byDate.get(date) ?? []));
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const showNow = days.includes(today);
  const openingHour = showNow
    ? Math.max(now.getHours() - 1, 0)
    : firstVisibleHour(blocksByDay.flat());

  const scrollTarget = useNativeState<string | null>(null);

  return (
    <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}>
      {compact ? (
        <VStack spacing={0}>
          <HStack spacing={0} modifiers={[padding({ vertical: spacing.xs })]}>
            <Spacer minLength={0} modifiers={[frame({ width: LABEL_WIDTH })]} />
            {days.map((date) => (
              <DayHeader key={date} date={date} isToday={date === today} onPress={onPressDay} />
            ))}
          </HStack>
          <Hairline axis="horizontal" />
        </VStack>
      ) : null}

      <ScrollView
        modifiers={[
          scrollPosition(scrollTarget, { anchor: 'top' }),
          // Once per page: not when the tab or page comes back, by when it has a position
          onAppear(() => {
            if (scrollTarget.get() === null) scrollTarget.set(String(openingHour));
          }),
          ...hideTabBarOnScroll,
        ]}
      >
        <ZStack
          alignment="topLeading"
          // Below: room for the floating add button
          modifiers={[padding({ top: spacing.sm, bottom: 96 })]}
        >
          <VStack spacing={0} modifiers={[scrollTargetLayout()]}>
            {HOURS.map((hour) => (
              <HStack
                key={hour}
                spacing={0}
                alignment="top"
                modifiers={[
                  id(String(hour)),
                  frame({ minHeight: HOUR_HEIGHT, maxHeight: HOUR_HEIGHT, alignment: 'top' }),
                ]}
              >
                <Text
                  modifiers={[
                    font({ size: 11 }),
                    monospacedDigit(),
                    foregroundStyle(colors.textTertiary),
                    padding({ trailing: spacing.xs + 2 }),
                    frame({ width: LABEL_WIDTH, alignment: 'trailing' }),
                    offset({ x: 0, y: -7 }),
                    // The now label takes the place of an hour label it would overlap
                    opacity(showNow && Math.abs(nowMinutes - hour * 60) < 15 ? 0 : 1),
                  ]}
                >
                  {clock(hour)}
                </Text>
                <Hairline axis="horizontal" />
              </HStack>
            ))}
          </VStack>

          <HStack spacing={0} modifiers={[frame({ minHeight: GRID_HEIGHT, maxHeight: GRID_HEIGHT })]}>
            <Spacer minLength={0} modifiers={[frame({ width: LABEL_WIDTH })]} />
            {days.map((date, dayIndex) => (
              <HStack key={date} spacing={0}>
                <Hairline axis="vertical" />
                <ZStack
                  alignment="topLeading"
                  modifiers={[
                    frame({
                      minWidth: 0,
                      maxWidth: Infinity,
                      minHeight: GRID_HEIGHT,
                      maxHeight: GRID_HEIGHT,
                      alignment: 'topLeading',
                    }),
                  ]}
                >
                  {blocksByDay[dayIndex].map((block) => {
                    const height = Math.max(toY(block.end) - toY(block.start), MIN_BLOCK_HEIGHT);
                    return (
                      // Equal slots across the column, with the block in its lane's
                      <HStack
                        key={block.appointment.id}
                        spacing={0}
                        modifiers={[
                          frame({ maxWidth: Infinity, minHeight: height, maxHeight: height }),
                          offset({ x: 0, y: toY(block.start) }),
                        ]}
                      >
                        {Array.from({ length: block.lanes }, (_, lane) =>
                          lane === block.lane ? (
                            <TimeGridBlock
                              key={lane}
                              appointment={block.appointment}
                              height={height}
                              compact={compact}
                              lanes={block.lanes}
                              onPress={onPressAppointment}
                            />
                          ) : (
                            <Spacer key={lane} minLength={0} modifiers={[frame({ maxWidth: Infinity })]} />
                          ),
                        )}
                      </HStack>
                    );
                  })}

                  {showNow ? (
                    <NowLine isToday={date === today} y={toY(nowMinutes)} />
                  ) : null}
                </ZStack>
              </HStack>
            ))}
          </HStack>

          {showNow ? (
            <Text
              modifiers={[
                font({ size: 11, weight: 'bold' }),
                monospacedDigit(),
                foregroundStyle(colors.onAccent),
                lineLimit(1),
                padding({ horizontal: 3, vertical: 1 }),
                background(colors.accent),
                clipShape('capsule'),
                padding({ trailing: 2 }),
                frame({ width: LABEL_WIDTH, alignment: 'trailing' }),
                offset({ x: 0, y: toY(nowMinutes) - 8 }),
              ]}
            >
              {clock(now.getHours(), now.getMinutes())}
            </Text>
          ) : null}
        </ZStack>
      </ScrollView>
    </VStack>
  );
}

function DayHeader({
  date,
  isToday,
  onPress,
}: {
  date: string;
  isToday: boolean;
  onPress?: (date: string) => void;
}) {
  return (
    <Button onPress={() => onPress?.(date)} modifiers={[buttonStyle('plain')]}>
      <VStack
        spacing={2}
        modifiers={[frame({ minWidth: 0, maxWidth: Infinity }), contentShape(shapes.rectangle())]}
      >
        <Text modifiers={[font({ size: 12 }), foregroundStyle(colors.textSecondary)]}>
          {WEEKDAY_LABELS[parseIsoDate(date).getDay()]}
        </Text>
        <Text
          modifiers={[
            font({ size: 14, weight: isToday ? 'bold' : 'regular' }),
            foregroundStyle(isToday ? colors.onAccent : colors.text),
            frame({ width: 26, height: 26 }),
            ...(isToday ? [background(colors.accent), clipShape('circle')] : []),
          ]}
        >
          {String(Number(date.slice(8)))}
        </Text>
      </VStack>
    </Button>
  );
}

/** Week view: a faint line across the other days, solid with a dot on today. */
function NowLine({ isToday, y }: { isToday: boolean; y: number }) {
  return (
    <>
      <Rectangle
        modifiers={[
          frame({ maxWidth: Infinity, minHeight: isToday ? 2 : 1, maxHeight: isToday ? 2 : 1 }),
          foregroundStyle(colors.accent),
          opacity(isToday ? 1 : 0.4),
          offset({ x: 0, y: y - 1 }),
        ]}
      />
      {isToday ? (
        <Circle
          modifiers={[
            frame({ width: 8, height: 8 }),
            foregroundStyle(colors.accent),
            offset({ x: -4, y: y - 4 }),
          ]}
        />
      ) : null}
    </>
  );
}

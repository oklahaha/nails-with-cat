/**
 * 時間表 (iOS): the title, segmented 日/週/月 picker, 今日, ‹ › and + button
 * around the calendar pages, which TimetablePager slides between as in iOS
 * Calendar.
 */
import {
  Button,
  HStack,
  Picker,
  ProgressView,
  Spacer,
  Text,
  VStack,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  buttonBorderShape,
  font,
  foregroundStyle,
  frame,
  kerning,
  labelStyle,
  lineLimit,
  minimumScaleFactor,
  padding,
  pickerStyle,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useMemo, useState } from 'react';

import {
  shiftAnchor,
  timetableRange,
  type ViewMode,
} from '@/components/calendar/timetablePages';
import { SwiftFab } from '@/components/swiftui/SwiftFab';
import { SwiftHost } from '@/components/swiftui/SwiftHost';
import { SwiftStateContent } from '@/components/swiftui/SwiftStateView';
import { TimetablePager } from '@/components/swiftui/TimetablePager';
import { glassButton } from '@/components/swiftui/glass';
import { colors, spacing } from '@/constants/theme';
import { prefetchAppointments, useAppointments } from '@/hooks/useAppointments';
import { useTabReselect } from '@/hooks/useTabReselect';
import {
  addMonths,
  formatMonthTitle,
  formatWeekTitle,
  todayIsoDate,
} from '@/utils/dates';
import { formatDateHeader } from '@/utils/groupByDate';

export default function TimetableScreen() {
  const [mode, setMode] = useState<ViewMode>('month');
  const [anchor, setAnchor] = useState(todayIsoDate);

  const range = useMemo(() => timetableRange(anchor), [anchor]);

  // The pages read this range from the cache; this loads it and reports progress
  const { loading, reloading, error, reload } = useAppointments(range);

  // Once this month is on screen, load the months either side so paging is instant
  useEffect(() => {
    if (loading) return;
    prefetchAppointments(timetableRange(addMonths(anchor, 1)));
    prefetchAppointments(timetableRange(addMonths(anchor, -1)));
  }, [anchor, loading]);

  const step = (direction: 1 | -1) => setAnchor(shiftAnchor(mode, anchor, direction));

  // Tapping the 時間表 tab again goes back to the month, from a day or week
  useTabReselect(() => setMode('month'));

  const openDay = (date: string) => {
    setAnchor(date);
    setMode('day');
  };

  const title =
    mode === 'month'
      ? formatMonthTitle(anchor)
      : mode === 'week'
        ? formatWeekTitle(anchor)
        : formatDateHeader(anchor);

  // The Host's safe area keeps all of this clear of the status bar and the floating tab bar
  return (
    <SwiftHost style={{ backgroundColor: colors.background }}>
      <ZStack
        alignment="bottomTrailing"
        modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}
      >
        <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}>
          <HStack
            spacing={spacing.sm}
            modifiers={[padding({ top: spacing.md, horizontal: spacing.md })]}
          >
            <Text
              modifiers={[
                font({ size: 22, weight: 'bold' }),
                kerning(-0.3),
                foregroundStyle(colors.text),
                lineLimit(1),
                minimumScaleFactor(0.6),
              ]}
            >
              {title}
            </Text>
            <Spacer />
            {reloading ? <ProgressView /> : null}
            <Button
              label="重新載入"
              systemImage="arrow.clockwise"
              onPress={() => void reload()}
              modifiers={[
                glassButton(),
                buttonBorderShape('circle'),
                labelStyle('iconOnly'),
                tint(colors.textSecondary),
              ]}
            />
            <Button
              label="今日"
              onPress={() => setAnchor(todayIsoDate())}
              modifiers={[
                glassButton(),
                buttonBorderShape('capsule'),
                tint(colors.accent),
              ]}
            />
          </HStack>

          <HStack
            modifiers={[
              padding({ top: spacing.md, bottom: spacing.sm, horizontal: spacing.md }),
            ]}
          >
            <Picker
              label="檢視"
              selection={mode}
              onSelectionChange={(value) => setMode(value as ViewMode)}
              modifiers={[pickerStyle('segmented'), frame({ width: 168 })]}
            >
              <Text modifiers={[tag('day')]}>日</Text>
              <Text modifiers={[tag('week')]}>週</Text>
              <Text modifiers={[tag('month')]}>月</Text>
            </Picker>
            <Spacer />
            <HStack spacing={spacing.sm}>
              <Button
                label="上一頁"
                systemImage="chevron.left"
                onPress={() => step(-1)}
                modifiers={[
                  glassButton(),
                  buttonBorderShape('circle'),
                  labelStyle('iconOnly'),
                  tint(colors.text),
                ]}
              />
              <Button
                label="下一頁"
                systemImage="chevron.right"
                onPress={() => step(1)}
                modifiers={[
                  glassButton(),
                  buttonBorderShape('circle'),
                  labelStyle('iconOnly'),
                  tint(colors.text),
                ]}
              />
            </HStack>
          </HStack>

          {loading ? (
            <SwiftStateContent loading title="載入時間表中…" />
          ) : error ? (
            <SwiftStateContent
              title="未能載入時間表"
              message={error}
              systemImage="exclamationmark.triangle"
              action={{ label: '重試', onPress: () => void reload() }}
            />
          ) : (
            // Swipe for the next / previous month, week or day, as in iOS Calendar
            <TimetablePager mode={mode} anchor={anchor} onAnchorChange={setAnchor} onPressDay={openDay} />
          )}
        </VStack>

        <SwiftFab date={mode === 'day' ? anchor : undefined} />
      </ZStack>
    </SwiftHost>
  );
}

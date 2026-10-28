/**
 * 時間表 (iOS) — the same React Native MonthView / TimeGrid layout as the
 * other platforms, paged by a SwiftUI TabView (TimetablePager) so swipes
 * slide between months / weeks / days as in iOS Calendar, with the controls
 * around it as small SwiftUI Host islands (segmented 日/週/月 picker, 今日,
 * ‹ ›, + button). SwiftUI has no calendar grid, so the grid itself stays in
 * React Native.
 */
import {
  Button,
  HStack,
  Host,
  Picker,
  ProgressView,
  Spacer,
  Text as SwiftText,
} from '@expo/ui/swift-ui';
import {
  buttonBorderShape,
  frame,
  labelStyle,
  pickerStyle,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  shiftAnchor,
  timetableRange,
  type ViewMode,
} from '@/components/calendar/timetablePages';
import { SwiftFab } from '@/components/swiftui/SwiftFab';
import { SwiftStateView } from '@/components/swiftui/SwiftStateView';
import { TimetablePager } from '@/components/swiftui/TimetablePager';
import { glassButton } from '@/components/swiftui/glass';
import { colors, spacing, type } from '@/constants/theme';
import { prefetchAppointments, useAppointments } from '@/hooks/useAppointments';
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

  // Bottom edge too: the native tab bar floats over the screen
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
          {title}
        </Text>
        <View style={styles.topActions}>
          <Host matchContents colorScheme="dark" seedColor={colors.accent}>
            <HStack spacing={spacing.sm}>
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
          </Host>
        </View>
      </View>

      {/* Width comes from React Native; only the height follows the SwiftUI content */}
      <Host
        matchContents={{ vertical: true }}
        colorScheme="dark"
        seedColor={colors.accent}
        style={styles.navRow}
      >
        <HStack>
          <Picker
            label="檢視"
            selection={mode}
            onSelectionChange={(value) => setMode(value as ViewMode)}
            modifiers={[pickerStyle('segmented'), frame({ width: 168 })]}
          >
            <SwiftText modifiers={[tag('day')]}>日</SwiftText>
            <SwiftText modifiers={[tag('week')]}>週</SwiftText>
            <SwiftText modifiers={[tag('month')]}>月</SwiftText>
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
      </Host>

      {loading ? (
        <SwiftStateView loading title="載入時間表中…" />
      ) : error ? (
        <SwiftStateView
          title="未能載入時間表"
          message={error}
          systemImage="exclamationmark.triangle"
          action={{ label: '重試', onPress: () => void reload() }}
        />
      ) : (
        // Swipe for the next / previous month, week or day, as in iOS Calendar
        <TimetablePager mode={mode} anchor={anchor} onAnchorChange={setAnchor} onPressDay={openDay} />
      )}

      <SwiftFab date={mode === 'day' ? anchor : undefined} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  title: {
    ...type.title,
    flexShrink: 1,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  navRow: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
});

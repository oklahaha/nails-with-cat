/**
 * 時間表 — SwiftUI calendar (日 / 週 / 月). Data via useAppointments unchanged.
 */
import {
  Button,
  HStack,
  List,
  Picker,
  Section,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  font,
  foregroundStyle,
  listStyle,
  pickerStyle,
  refreshable,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { AppointmentRow } from '@/components/swiftui/AppointmentRow';
import { SwiftFab } from '@/components/swiftui/SwiftFab';
import { SwiftHost } from '@/components/swiftui/SwiftHost';
import { SwiftStateView } from '@/components/swiftui/SwiftStateView';
import { serviceColor } from '@/constants/services';
import { colors } from '@/constants/theme';
import { prefetchAppointments, useAppointments } from '@/hooks/useAppointments';
import type { Appointment } from '@/types/appointment';
import { openAppointmentDetails } from '@/utils/appointmentActions';
import { appointmentTitle } from '@/utils/appointmentTitle';
import {
  addDays,
  addMonths,
  formatMonthTitle,
  formatWeekTitle,
  isSameMonth,
  monthGrid,
  todayIsoDate,
  weekDates,
  WEEKDAY_LABELS,
} from '@/utils/dates';
import { formatDateHeader } from '@/utils/groupByDate';

type ViewMode = 'day' | 'week' | 'month';

export default function TimetableScreen() {
  const [mode, setMode] = useState<ViewMode>('month');
  const [anchor, setAnchor] = useState(todayIsoDate);
  const today = todayIsoDate();

  const range = useMemo(() => timetableRange(anchor), [anchor]);
  const { appointments, loading, error, reload } = useAppointments(range);

  useEffect(() => {
    if (loading) return;
    prefetchAppointments(timetableRange(addMonths(anchor, 1)));
    prefetchAppointments(timetableRange(addMonths(anchor, -1)));
  }, [anchor, loading]);

  const byDate = useMemo(() => groupByDateSorted(appointments), [appointments]);

  const step = (direction: 1 | -1) => {
    if (mode === 'month') setAnchor(addMonths(anchor, direction));
    else setAnchor(addDays(anchor, direction * (mode === 'week' ? 7 : 1)));
  };

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

  if (loading) {
    return <SwiftStateView loading title="載入時間表中…" />;
  }

  if (error) {
    return (
      <SwiftStateView
        title="未能載入時間表"
        message={error}
        systemImage="exclamationmark.triangle"
        action={{ label: '重試', onPress: () => void reload() }}
      />
    );
  }

  const dayList =
    mode === 'day'
      ? (byDate.get(anchor) ?? [])
      : mode === 'week'
        ? weekDates(anchor).flatMap((d) => byDate.get(d) ?? [])
        : [];

  return (
    <View style={{ flex: 1 }}>
      <SwiftHost>
        <List
          modifiers={[
            listStyle('insetGrouped'),
            refreshable(async () => {
              await reload();
            }),
          ]}
        >
          <Section>
            <HStack spacing={8}>
              <Text modifiers={[font({ size: 20, weight: 'bold' })]}>{title}</Text>
              <Spacer />
              <Button
                label="今日"
                onPress={() => setAnchor(today)}
                modifiers={[buttonStyle('bordered'), tint(colors.accent)]}
              />
              <Button
                label="上一頁"
                systemImage="chevron.left"
                onPress={() => step(-1)}
                modifiers={[buttonStyle('bordered')]}
              />
              <Button
                label="下一頁"
                systemImage="chevron.right"
                onPress={() => step(1)}
                modifiers={[buttonStyle('bordered')]}
              />
            </HStack>

            <Picker
              label="檢視"
              selection={mode}
              onSelectionChange={(value) => setMode(value as ViewMode)}
              modifiers={[pickerStyle('segmented')]}
            >
              <Text modifiers={[tag('day')]}>日</Text>
              <Text modifiers={[tag('week')]}>週</Text>
              <Text modifiers={[tag('month')]}>月</Text>
            </Picker>
          </Section>

          {mode === 'month' ? (
            <MonthSections
              anchor={anchor}
              today={today}
              byDate={byDate}
              onPressDay={openDay}
            />
          ) : mode === 'week' ? (
            weekDates(anchor).map((date) => {
              const list = byDate.get(date) ?? [];
              return (
                <Section
                  key={date}
                  title={formatDateHeader(date)}
                  header={
                    <Button
                      label="查看日"
                      onPress={() => openDay(date)}
                      modifiers={[buttonStyle('plain'), tint(colors.accent)]}
                    />
                  }
                >
                  {list.length === 0 ? (
                    <Text
                      modifiers={[
                        foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                      ]}
                    >
                      沒有預約
                    </Text>
                  ) : (
                    list.map((apt) => <AppointmentRow key={apt.id} appointment={apt} />)
                  )}
                </Section>
              );
            })
          ) : (
            <Section title="當日預約">
              {dayList.length === 0 ? (
                <Text
                  modifiers={[
                    foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                  ]}
                >
                  這天沒有預約
                </Text>
              ) : (
                dayList.map((apt) => <AppointmentRow key={apt.id} appointment={apt} />)
              )}
            </Section>
          )}
        </List>
      </SwiftHost>

      <SwiftFab date={mode === 'day' ? anchor : undefined} />
    </View>
  );
}

function MonthSections({
  anchor,
  today,
  byDate,
  onPressDay,
}: {
  anchor: string;
  today: string;
  byDate: Map<string, Appointment[]>;
  onPressDay: (date: string) => void;
}) {
  const weeks = monthGrid(anchor);

  return (
    <>
      <Section title="月曆">
        <HStack spacing={4}>
          {WEEKDAY_LABELS.map((label) => (
            <Text
              key={label}
              modifiers={[
                font({ size: 12, weight: 'semibold' }),
                foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
              ]}
            >
              {label}
            </Text>
          ))}
        </HStack>
      </Section>

      {weeks.map((week) => (
        <Section key={week[0]}>
          <HStack spacing={4}>
            {week.map((date) => {
              const inMonth = isSameMonth(date, anchor);
              const list = byDate.get(date) ?? [];
              const isToday = date === today;
              const dayNum = Number(date.slice(8));

              return (
                <Button
                  key={date}
                  onPress={() => onPressDay(date)}
                  modifiers={[buttonStyle('plain')]}
                >
                  <VStack spacing={2} alignment="center">
                    <Text
                      modifiers={[
                        font({
                          size: 15,
                          weight: isToday ? 'bold' : 'regular',
                        }),
                        ...(isToday
                          ? [tint(colors.accent)]
                          : !inMonth
                            ? [
                                foregroundStyle({
                                  type: 'hierarchical' as const,
                                  style: 'tertiary' as const,
                                }),
                              ]
                            : []),
                      ]}
                    >
                      {dayNum}
                    </Text>
                    {list.slice(0, 2).map((apt) => (
                      <Text
                        key={apt.id}
                        modifiers={[
                          font({ size: 9 }),
                          tint(serviceColor(apt.service)),
                        ]}
                      >
                        {appointmentTitle(apt).slice(0, 4)}
                      </Text>
                    ))}
                    {list.length > 2 ? (
                      <Text
                        modifiers={[
                          font({ size: 9 }),
                          foregroundStyle({
                            type: 'hierarchical',
                            style: 'secondary',
                          }),
                        ]}
                      >
                        +{list.length - 2}
                      </Text>
                    ) : null}
                  </VStack>
                </Button>
              );
            })}
          </HStack>
        </Section>
      ))}

      <Section title="本月預約">
        {[...byDate.entries()]
          .filter(([date]) => isSameMonth(date, anchor))
          .sort(([a], [b]) => a.localeCompare(b))
          .flatMap(([, list]) => list)
          .slice(0, 40)
          .map((apt) => (
            <Button
              key={apt.id}
              onPress={() => openAppointmentDetails(apt)}
              modifiers={[buttonStyle('plain')]}
            >
              <HStack>
                <Text modifiers={[font({ weight: 'semibold' })]}>
                  {apt.date.slice(5)} {apt.time}
                </Text>
                <Spacer />
                <Text
                  modifiers={[
                    foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                  ]}
                >
                  {appointmentTitle(apt)}
                </Text>
              </HStack>
            </Button>
          ))}
      </Section>
    </>
  );
}

function timetableRange(anchor: string): { from: string; to: string } {
  const grid = monthGrid(anchor);
  const week = weekDates(anchor);
  const from = week[0] < grid[0][0] ? week[0] : grid[0][0];
  const last = grid[grid.length - 1][6];
  const to = week[6] > last ? week[6] : last;
  return { from, to };
}

function groupByDateSorted(appointments: Appointment[]): Map<string, Appointment[]> {
  const map = new Map<string, Appointment[]>();
  for (const apt of appointments) {
    const list = map.get(apt.date) ?? [];
    list.push(apt);
    map.set(apt.date, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.time.localeCompare(b.time));
  return map;
}

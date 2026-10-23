/**
 * 預約資料 — SwiftUI List of upcoming appointments grouped by date.
 * Data still comes from useAppointments → Apps Script / mock.
 */
import {
  Button,
  HStack,
  List,
  NavigationStack,
  Section,
  Spacer,
  Text,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  contentShape,
  font,
  foregroundStyle,
  listStyle,
  navigationTitle,
  refreshable,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { AppointmentRow } from '@/components/swiftui/AppointmentRow';
import { SwiftFab } from '@/components/swiftui/SwiftFab';
import { SwiftHost } from '@/components/swiftui/SwiftHost';
import { SwiftStateView } from '@/components/swiftui/SwiftStateView';
import { useAppointments } from '@/hooks/useAppointments';
import type { Appointment } from '@/types/appointment';
import { addDays, todayIsoDate } from '@/utils/dates';
import { formatDateHeader, groupAppointmentsByDate } from '@/utils/groupByDate';

export default function AppointmentsScreen() {
  const today = todayIsoDate();
  const tomorrow = addDays(today, 1);
  const { appointments, loading, error, reload } = useAppointments({ from: today });

  const groups = useMemo(() => groupAppointmentsByDate(appointments), [appointments]);

  if (loading) {
    return <SwiftStateView loading title="載入預約中…" />;
  }

  if (error) {
    return (
      <SwiftStateView
        title="未能載入預約"
        message={error}
        systemImage="exclamationmark.triangle"
        action={{ label: '重試', onPress: () => void reload() }}
      />
    );
  }

  if (groups.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        <SwiftStateView
          title="目前沒有預約"
          message="新增的預約會按日期列在這裡。"
          systemImage="calendar"
          action={{ label: '新增預約', onPress: () => router.push('/add-appointment') }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <SwiftHost>
        <NavigationStack>
          <List
            modifiers={[
              navigationTitle('預約資料'),
              listStyle('insetGrouped'),
              refreshable(async () => {
                await reload(true);
              }),
            ]}
          >
            {groups.map((group) => {
              const relative =
                group.date === today ? '今日' : group.date === tomorrow ? '明日' : null;
              const title = relative
                ? `${relative}  ${formatDateHeader(group.date)}`
                : formatDateHeader(group.date);

              return (
                <Section
                  key={group.date}
                  title={title}
                  footer={
                    <Text
                      modifiers={[
                        font({ size: 12 }),
                        foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                      ]}
                    >
                      {group.appointments.length} 個預約
                    </Text>
                  }
                >
                  {group.appointments.map((apt: Appointment) => (
                    <AppointmentRow key={apt.id} appointment={apt} />
                  ))}
                </Section>
              );
            })}

            <Section>
              <Button
                onPress={() => router.push('/add-appointment')}
                modifiers={[buttonStyle('plain')]}
              >
                <HStack modifiers={[contentShape(shapes.rectangle())]}>
                  <Text modifiers={[font({ weight: 'semibold' })]}>新增預約</Text>
                  <Spacer />
                </HStack>
              </Button>
            </Section>
          </List>
        </NavigationStack>
      </SwiftHost>
      <SwiftFab />
    </View>
  );
}

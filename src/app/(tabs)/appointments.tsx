/**
 * 預約資料 tab — upcoming appointments (today onwards) grouped by date.
 */
import { router } from 'expo-router';
import { useMemo } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';

import { AddButton } from '@/components/AddButton';
import { AppointmentCard } from '@/components/AppointmentCard';
import { StateView } from '@/components/StateView';
import { colors, spacing, type } from '@/constants/theme';
import { useAppointments } from '@/hooks/useAppointments';
import type { Appointment } from '@/types/appointment';
import { addDays, todayIsoDate } from '@/utils/dates';
import { formatDateHeader, groupAppointmentsByDate } from '@/utils/groupByDate';

type Section = { date: string; data: Appointment[] };

export default function AppointmentsScreen() {
  const today = todayIsoDate();
  const { appointments, loading, refreshing, error, reload } = useAppointments({
    from: today,
  });

  const sections = useMemo(
    () =>
      groupAppointmentsByDate(appointments).map((group) => ({
        date: group.date,
        data: group.appointments,
      })),
    [appointments]
  );

  if (loading) {
    return <StateView loading title="載入預約中…" />;
  }

  if (error) {
    return (
      <StateView
        title="未能載入預約"
        message={error}
        tone="error"
        action={{ label: '重試', onPress: () => void reload() }}
      />
    );
  }

  const tomorrow = addDays(today, 1);

  return (
    <View style={styles.container}>
      <SectionList<Appointment, Section>
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => {
          const relative =
            section.date === today ? '今日' : section.date === tomorrow ? '明日' : null;
          return (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {relative ?? formatDateHeader(section.date)}
                {relative ? (
                  <Text style={styles.sectionDate}>{`  ${formatDateHeader(section.date)}`}</Text>
                ) : null}
              </Text>
              <Text style={styles.sectionCount}>{section.data.length} 個預約</Text>
            </View>
          );
        }}
        renderSectionFooter={() => <View style={styles.sectionGap} />}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.scrollContent}
        ListEmptyComponent={
          <StateView
            icon="calendar"
            title="目前沒有預約"
            message="新增的預約會按日期列在這裡。"
            action={{ label: '新增預約', onPress: () => router.push('/add-appointment') }}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void reload(true)}
            tintColor={colors.accent}
          />
        }
      />

      {sections.length > 0 ? <AddButton /> : null}
    </View>
  );
}

const keyExtractor = (apt: Appointment) => apt.id;

const renderItem = ({ item }: { item: Appointment }) => <AppointmentCard appointment={item} />;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    // Leave room for the floating add button
    paddingBottom: 96,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...type.heading,
    flexShrink: 1,
  },
  sectionDate: {
    ...type.caption,
    fontWeight: '500',
  },
  sectionCount: {
    ...type.caption,
    fontSize: 12,
  },
  sectionGap: {
    height: spacing.lg,
  },
});

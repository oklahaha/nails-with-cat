/**
 * 預約資料 tab — upcoming appointments (today onwards) grouped by date.
 */
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AddButton } from '@/components/AddButton';
import { AppointmentCard } from '@/components/AppointmentCard';
import { colors, radius, spacing } from '@/constants/theme';
import { useAppointments } from '@/hooks/useAppointments';
import { todayIsoDate } from '@/utils/dates';
import { formatDateHeader, groupAppointmentsByDate } from '@/utils/groupByDate';

export default function AppointmentsScreen() {
  const { appointments, loading, refreshing, error, reload } = useAppointments({
    from: todayIsoDate(),
  });

  const grouped = groupAppointmentsByDate(appointments);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>載入預約中…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryBtn} onPress={() => void reload()}>
          <Text style={styles.retryText}>重試</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void reload(true)}
            tintColor={colors.accent}
          />
        }
      >
        {grouped.length === 0 ? (
          <Text style={styles.empty}>目前沒有預約</Text>
        ) : (
          grouped.map((section) => (
            <View key={section.date} style={styles.section}>
              <Text style={styles.sectionTitle}>
                {formatDateHeader(section.date)}
              </Text>
              {section.appointments.map((apt) => (
                <AppointmentCard key={apt.id} appointment={apt} />
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <AddButton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
    // Leave room for the floating add button
    paddingBottom: 96,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  empty: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: spacing.xl,
    fontSize: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
  },
  errorText: {
    color: colors.danger,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  retryText: {
    color: colors.onAccent,
    fontWeight: '600',
  },
});

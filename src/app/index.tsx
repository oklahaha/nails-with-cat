/**
 * Home screen — list of appointments grouped by date.
 *
 * Data source: appointmentsApi.listAppointments()
 * Swap mock → Google Apps Script inside that service file only.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppointmentCard } from '@/components/AppointmentCard';
import { colors, radius, spacing } from '@/constants/theme';
import { listAppointments } from '@/services/appointmentsApi';
import type { Appointment } from '@/types/appointment';
import {
  formatDateHeader,
  groupAppointmentsByDate,
} from '@/utils/groupByDate';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const data = await listAppointments();
      setAppointments(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入失敗');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
        <Pressable style={styles.retryBtn} onPress={() => void load()}>
          <Text style={styles.retryText}>重試</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 88 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
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

      {/* Floating CTA → Add Appointment screen */}
      <Link href="/add-appointment" asChild>
        <Pressable
          style={({ pressed }) => [
            styles.fab,
            { bottom: insets.bottom + spacing.md },
            pressed && styles.fabPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="新增預約"
        >
          <Text style={styles.fabText}>＋ 新增預約</Text>
        </Pressable>
      </Link>
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
    color: '#FFFFFF',
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabPressed: {
    opacity: 0.9,
  },
  fabText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});

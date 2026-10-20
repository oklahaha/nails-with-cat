/**
 * 顧客資料 tab — searchable customer list from the 顧客 sheet.
 * Each row can WhatsApp the customer or start a booking with their name filled in.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Icon } from '@/components/Icon';
import { colors, radius, spacing } from '@/constants/theme';
import { listCustomers } from '@/services/appointmentsApi';
import type { Customer } from '@/types/customer';
import { openWhatsApp } from '@/utils/whatsapp';

export default function CustomersScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await listCustomers();
      setCustomers(data.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant')));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入失敗');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    const digits = q.replace(/[^\d]/g, '');
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || (digits !== '' && c.phone.includes(digits))
    );
  }, [customers, query]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.mutedText}>載入顧客中…</Text>
      </View>
    );
  }

  if (error && customers.length === 0) {
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
      <View style={styles.searchBox}>
        <Icon name="search" color={colors.textSecondary} size={20} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="搜尋姓名或電話"
          placeholderTextColor={colors.textSecondary}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(c, index) => c.id || `${c.name}-${index}`}
        renderItem={({ item }) => <CustomerRow customer={item} />}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={colors.accent}
          />
        }
        ListHeaderComponent={
          <Text style={styles.count}>共 {filtered.length} 位顧客</Text>
        }
        ListEmptyComponent={<Text style={styles.empty}>找不到顧客</Text>}
      />
    </View>
  );
}

function CustomerRow({ customer }: { customer: Customer }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowInfo}>
        <Text style={styles.name} numberOfLines={1}>
          {customer.name}
        </Text>
        <Text style={styles.phone}>{formatPhone(customer.phone) || '未有電話'}</Text>
      </View>

      {customer.phone ? (
        <Pressable
          onPress={() => void openWhatsApp(customer.phone)}
          style={({ pressed }) => [styles.whatsappBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`用 WhatsApp 聯絡 ${customer.name}`}
        >
          <Text style={styles.btnText}>WhatsApp</Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={() =>
          router.push({
            pathname: '/add-appointment',
            params: { customerName: customer.name },
          })
        }
        style={({ pressed }) => [styles.bookBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`為 ${customer.name} 新增預約`}
      >
        <Text style={styles.btnText}>預約</Text>
      </Pressable>
    </View>
  );
}

/** 85291234567 → +852 9123 4567; other numbers are shown as stored. */
function formatPhone(phone: string): string {
  const m = phone.match(/^852(\d{4})(\d{4})$/);
  return m ? `+852 ${m[1]} ${m[2]}` : phone;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.md,
    marginBottom: 0,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: colors.text,
  },
  listContent: {
    padding: spacing.md,
  },
  count: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowInfo: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  phone: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  whatsappBtn: {
    backgroundColor: colors.whatsapp,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  bookBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  btnText: {
    color: colors.onAccent,
    fontWeight: '700',
    fontSize: 13,
  },
  empty: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: spacing.xl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  mutedText: {
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

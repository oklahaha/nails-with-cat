/**
 * 顧客資料 tab — searchable customer list from the 顧客 sheet.
 * Tapping a customer opens their details (edit / delete). Each row can also
 * WhatsApp the customer or start a booking with their name filled in; the ＋
 * button adds a customer.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AddButton } from '@/components/AddButton';
import { Icon } from '@/components/Icon';
import { WhatsAppIcon } from '@/components/WhatsAppIcon';
import { StateView } from '@/components/StateView';
import { colors, pressedStyle, radius, spacing, type } from '@/constants/theme';
import { useCustomers } from '@/hooks/useCustomers';
import type { Customer } from '@/types/customer';
import { formatPhone } from '@/utils/phone';
import { openWhatsApp } from '@/utils/whatsapp';

export default function CustomersScreen() {
  const { customers, loading, refreshing, error, reload } = useCustomers();
  const [query, setQuery] = useState('');

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
    return <StateView loading title="載入顧客中…" />;
  }

  if (error && customers.length === 0) {
    return (
      <StateView
        title="未能載入顧客"
        message={error}
        tone="error"
        action={{ label: '重試', onPress: () => void reload() }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Icon name="search" color={colors.textTertiary} size={18} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="搜尋姓名或電話"
          placeholderTextColor={colors.textTertiary}
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void reload(true)}
            tintColor={colors.accent}
          />
        }
        ListHeaderComponent={
          filtered.length > 0 ? (
            <Text style={styles.count}>
              {query.trim() ? `找到 ${filtered.length} 位顧客` : `共 ${filtered.length} 位顧客`}
            </Text>
          ) : undefined
        }
        ListEmptyComponent={
          <StateView
            icon="person"
            title={query.trim() ? '找不到顧客' : '未有顧客資料'}
            message={query.trim() ? `沒有符合「${query.trim()}」的姓名或電話。` : undefined}
          />
        }
      />

      <AddButton
        // A search with no match is often a new customer, so prefill it
        onPress={() => router.push({ pathname: '/add-customer', params: prefillFrom(query, filtered) })}
        accessibilityLabel="新增顧客"
      />
    </View>
  );
}

/** The unmatched search as the new customer's name, or phone if it's a number. */
function prefillFrom(query: string, matches: Customer[]): { name?: string; phone?: string } {
  const q = query.trim();
  if (!q || matches.length > 0) return {};
  return /^[\d\s+()-]+$/.test(q) ? { phone: q.replace(/[^\d]/g, '') } : { name: q };
}

const keyExtractor = (c: Customer, index: number) => c.id || `${c.name}-${index}`;

const renderItem = ({ item }: { item: Customer }) => <CustomerRow customer={item} />;

function CustomerRow({ customer }: { customer: Customer }) {
  // The buttons sit beside the tappable area, not inside it, since buttons
  // can't nest on web
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() =>
          router.push({
            pathname: '/customer-details',
            params: customer.id ? { id: customer.id, name: customer.name } : { name: customer.name },
          })
        }
        style={({ pressed }) => [styles.rowMain, pressed && pressedStyle]}
        accessibilityRole="button"
        accessibilityLabel={`${customer.name} 的顧客資料`}
      >
        <View style={styles.avatar}>
          {/* Array.from keeps emoji (surrogate pairs) whole */}
          <Text style={styles.avatarText}>{Array.from(customer.name)[0] ?? ''}</Text>
        </View>

        <View style={styles.rowInfo}>
          <Text style={styles.name} numberOfLines={1}>
            {customer.name}
          </Text>
          <Text style={[styles.phone, !customer.phone && styles.phoneMissing]}>
            {formatPhone(customer.phone) || '未有電話'}
          </Text>
        </View>
      </Pressable>

      {customer.phone ? (
        <Pressable
          onPress={() => void openWhatsApp(customer.phone)}
          hitSlop={4}
          style={({ pressed }) => [styles.whatsappBtn, pressed && pressedStyle]}
          accessibilityRole="button"
          accessibilityLabel={`用 WhatsApp 聯絡 ${customer.name}`}
        >
          <WhatsAppIcon size={20} />
        </Pressable>
      ) : null}

      <Pressable
        onPress={() =>
          router.push({
            pathname: '/add-appointment',
            params: { customerName: customer.name },
          })
        }
        style={({ pressed }) => [styles.bookBtn, pressed && pressedStyle]}
        accessibilityRole="button"
        accessibilityLabel={`為 ${customer.name} 新增預約`}
      >
        <Text style={styles.bookText}>預約</Text>
      </Pressable>
    </View>
  );
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
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm + 3,
    fontSize: 16,
    color: colors.text,
  },
  listContent: {
    flexGrow: 1,
    padding: spacing.md,
    // Keep the last row clear of the ＋ button
    paddingBottom: 56 + spacing.md * 2,
  },
  count: {
    ...type.caption,
    fontSize: 12,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md - 4,
    marginBottom: spacing.sm,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.sm + 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
  },
  avatarText: {
    color: colors.accent,
    fontSize: 17,
    fontWeight: '700',
  },
  rowInfo: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  phone: {
    ...type.caption,
    ...type.time,
    marginTop: 2,
  },
  phoneMissing: {
    color: colors.textTertiary,
  },
  whatsappBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.whatsapp,
  },
  bookBtn: {
    height: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
  },
  bookText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 14,
  },
});

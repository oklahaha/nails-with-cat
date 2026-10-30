/** Everyone in one 顧客分群 segment, opened from 統計. */
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { StateView } from '@/components/StateView';
import { WhatsAppIcon } from '@/components/WhatsAppIcon';
import { colors, pressedStyle, radius, spacing, type } from '@/constants/theme';
import { useCustomerAnalytics } from '@/hooks/useCustomerAnalytics';
import { useCustomers } from '@/hooks/useCustomers';
import {
  formatPercent,
  insightSummary,
  segmentCustomers,
  segmentSummary,
  type InsightRow,
} from '@/utils/customerAnalytics';
import { formatMoney } from '@/utils/stats';
import { openWhatsApp } from '@/utils/whatsapp';

export default function SegmentCustomersScreen() {
  const { segment = '' } = useLocalSearchParams<{ segment?: string }>();
  const { analytics } = useCustomerAnalytics();
  const { customers } = useCustomers();

  const rows = useMemo(
    () => (analytics ? segmentCustomers(analytics, customers, segment) : []),
    [analytics, customers, segment]
  );
  const summary = useMemo(
    () => (analytics ? segmentSummary(analytics).find((s) => s.segment === segment) : undefined),
    [analytics, segment]
  );

  const openCustomer = (row: InsightRow) => {
    // Rows without a 顧客ID in the sheet are found by name
    const hasId = customers.some((c) => c.id === row.customerId);
    router.push({
      pathname: '/customer-details',
      params: hasId ? { id: row.customerId, name: row.name } : { name: row.name },
    });
  };

  if (rows.length === 0) {
    return <StateView title="沒有顧客" message="這個分群暫時沒有顧客" />;
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={rows}
      keyExtractor={(c) => c.customerId}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>
            {rows.length} 位 · 佔預計收入 {formatPercent(summary?.clvShare ?? 0)}
          </Text>
          <Text style={styles.caption}>
            {summary?.description}。右邊為未來 12 個月預計消費，最高的排先。
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const { phone } = item;
        return (
          <View style={styles.row}>
            <Pressable
              onPress={() => openCustomer(item)}
              style={({ pressed }) => [styles.main, pressed && pressedStyle]}
              accessibilityRole="button"
              accessibilityLabel={`${item.name} ${insightSummary(item)}`}
            >
              <View style={styles.body}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.detail} numberOfLines={1}>
                  {insightSummary(item)}
                </Text>
              </View>
              <Text style={styles.value}>{formatMoney(item.clv12m)}</Text>
            </Pressable>
            {phone ? (
              <Pressable
                onPress={() => void openWhatsApp(phone)}
                hitSlop={6}
                style={({ pressed }) => [styles.whatsappBtn, pressed && pressedStyle]}
                accessibilityRole="button"
                accessibilityLabel={`WhatsApp ${item.name}`}
              >
                <WhatsAppIcon size={18} />
              </Pressable>
            ) : null}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    gap: 2,
    marginBottom: spacing.sm,
  },
  title: {
    ...type.heading,
  },
  caption: {
    ...type.caption,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...type.body,
    fontWeight: '600',
  },
  detail: {
    ...type.caption,
    fontSize: 12,
  },
  value: {
    ...type.body,
    ...type.time,
    fontWeight: '600',
  },
  whatsappBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.whatsapp,
  },
});

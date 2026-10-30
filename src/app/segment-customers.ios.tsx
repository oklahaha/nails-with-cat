/**
 * Everyone in one 顧客分群 segment — SwiftUI List, opened from 統計. Rows are
 * added a page at a time, since an @expo/ui List mounts every row and the
 * largest segments hold hundreds.
 */
import { Button, List, Section, Text } from '@expo/ui/swift-ui';
import { buttonStyle, listStyle, tint } from '@expo/ui/swift-ui/modifiers';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

import { SwiftModal } from '@/components/swiftui/SwiftModal';
import { SwiftStateView } from '@/components/swiftui/SwiftStateView';
import { CustomerStatRow } from '@/components/swiftui/stats/statsParts';
import { colors } from '@/constants/theme';
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

const PAGE_SIZE = 50;

function close() {
  if (router.canGoBack()) router.back();
}

export default function SegmentCustomersScreen() {
  const { segment = '' } = useLocalSearchParams<{ segment?: string }>();
  const { analytics } = useCustomerAnalytics();
  const { customers } = useCustomers();
  const [limit, setLimit] = useState(PAGE_SIZE);

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

  return (
    <SwiftModal onClose={close}>
      {rows.length === 0 ? (
        <SwiftStateView title="沒有顧客" message="這個分群暫時沒有顧客" systemImage="person.2" />
      ) : (
        <List modifiers={[listStyle('insetGrouped')]}>
          <Section
            title={`${rows.length} 位 · 佔預計收入 ${formatPercent(summary?.clvShare ?? 0)}`}
            footer={<Text>{summary?.description}。右邊為未來 12 個月預計消費，最高的排先。</Text>}
          >
            {rows.slice(0, limit).map((c) => (
              <CustomerStatRow
                key={c.customerId}
                customer={c}
                detail={insightSummary(c)}
                value={formatMoney(c.clv12m)}
                onPress={() => openCustomer(c)}
                showWhatsApp
              />
            ))}
            {rows.length > limit ? (
              <Button
                label={`顯示更多（尚有 ${rows.length - limit} 位）`}
                onPress={() => setLimit((n) => n + PAGE_SIZE)}
                modifiers={[buttonStyle('plain'), tint(colors.accent)]}
              />
            ) : null}
          </Section>
        </List>
      )}
    </SwiftModal>
  );
}

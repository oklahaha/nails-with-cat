/**
 * 顧客資料 — SwiftUI searchable List. API via useCustomers unchanged.
 */
import {
  Button,
  HStack,
  List,
  Section,
  Spacer,
  Text,
  VStack,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  font,
  foregroundStyle,
  listStyle,
  refreshable,
  searchable,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { SwiftFab } from '@/components/swiftui/SwiftFab';
import { SwiftHost } from '@/components/swiftui/SwiftHost';
import { SwiftStateView } from '@/components/swiftui/SwiftStateView';
import { colors } from '@/constants/theme';
import { useCustomers } from '@/hooks/useCustomers';
import type { Customer } from '@/types/customer';
import { formatPhone } from '@/utils/phone';
import { openWhatsApp } from '@/utils/whatsapp';

export default function CustomersScreen() {
  const { customers, loading, error, reload } = useCustomers();
  const searchText = useNativeState('');
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
    return <SwiftStateView loading title="載入顧客中…" systemImage="person" />;
  }

  if (error && customers.length === 0) {
    return (
      <SwiftStateView
        title="未能載入顧客"
        message={error}
        systemImage="exclamationmark.triangle"
        action={{ label: '重試', onPress: () => void reload() }}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <SwiftHost>
        <List
          modifiers={[
            listStyle('insetGrouped'),
            refreshable(() => reload(true)),
            searchable(searchText, {
              prompt: '搜尋姓名或電話',
              onChange: setQuery,
            }),
          ]}
        >
          <Section
            header={
              <Text
                modifiers={[
                  font({ size: 12 }),
                  foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                ]}
              >
                {query.trim()
                  ? `找到 ${filtered.length} 位顧客`
                  : `共 ${filtered.length} 位顧客`}
              </Text>
            }
          >
            {filtered.length === 0 ? (
              <Text
                modifiers={[
                  foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                ]}
              >
                {query.trim()
                  ? `沒有符合「${query.trim()}」的姓名或電話。`
                  : '未有顧客資料'}
              </Text>
            ) : (
              filtered.map((customer, index) => (
                <CustomerRow
                  key={customer.id || `${customer.name}-${index}`}
                  customer={customer}
                />
              ))
            )}
          </Section>
        </List>
      </SwiftHost>

      <SwiftFab
        label="新增顧客"
        onPress={() =>
          router.push({
            pathname: '/add-customer',
            params: prefillFrom(query, filtered),
          })
        }
      />
    </View>
  );
}

function prefillFrom(query: string, matches: Customer[]): { name?: string; phone?: string } {
  const q = query.trim();
  if (!q || matches.length > 0) return {};
  return /^[\d\s+()-]+$/.test(q) ? { phone: q.replace(/[^\d]/g, '') } : { name: q };
}

function CustomerRow({ customer }: { customer: Customer }) {
  return (
    <HStack spacing={8}>
      <Button
        onPress={() =>
          router.push({
            pathname: '/customer-details',
            params: customer.id
              ? { id: customer.id, name: customer.name }
              : { name: customer.name },
          })
        }
        modifiers={[buttonStyle('plain')]}
      >
        <HStack spacing={12}>
          <Text modifiers={[font({ size: 20, weight: 'bold' }), tint(colors.accent)]}>
            {Array.from(customer.name)[0] ?? ''}
          </Text>
          <VStack spacing={2} alignment="leading">
            <Text modifiers={[font({ size: 16, weight: 'semibold' })]}>{customer.name}</Text>
            <Text
              modifiers={[
                font({ size: 13 }),
                foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
              ]}
            >
              {formatPhone(customer.phone) || '未有電話'}
            </Text>
          </VStack>
        </HStack>
      </Button>

      <Spacer />

      {customer.phone ? (
        <Button
          label="WhatsApp"
          systemImage="message.fill"
          onPress={() => void openWhatsApp(customer.phone)}
          modifiers={[buttonStyle('bordered'), tint(colors.whatsapp)]}
        />
      ) : null}

      <Button
        label="預約"
        onPress={() =>
          router.push({
            pathname: '/add-appointment',
            params: { customerName: customer.name },
          })
        }
        modifiers={[buttonStyle('bordered'), tint(colors.accent)]}
      />
    </HStack>
  );
}

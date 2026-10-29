/**
 * 顧客資料 — SwiftUI searchable List. API via useCustomers unchanged.
 *
 * Every row of an @expo/ui List is a React element, mounted whether it's on
 * screen or not, so rows are added a page at a time as the end comes near.
 * Long-pressing a row opens a menu with 修改 and 刪除.
 */
import {
  Alert,
  Button,
  ContextMenu,
  HStack,
  List,
  NavigationStack,
  Section,
  Spacer,
  Text,
  VStack,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  contentShape,
  font,
  foregroundStyle,
  listStyle,
  navigationTitle,
  refreshable,
  scrollDismissesKeyboard,
  searchable,
  shapes,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { router } from 'expo-router';
import { memo, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { SwiftFab } from '@/components/swiftui/SwiftFab';
import { SwiftHost } from '@/components/swiftui/SwiftHost';
import { useHideTabBarOnScrollModifiers } from '@/components/swiftui/hideTabBarOnScroll';
import { SwiftStateView } from '@/components/swiftui/SwiftStateView';
import { glassButton } from '@/components/swiftui/glass';
import { ownRowBackground, ownRowInsets } from '@/components/swiftui/listRow';
import { WhatsAppButton } from '@/components/swiftui/WhatsAppButton';
import { colors } from '@/constants/theme';
import { removeCustomer } from '@/hooks/customerWrites';
import { useCustomers } from '@/hooks/useCustomers';
import type { Customer } from '@/types/customer';
import { formatPhone } from '@/utils/phone';
import { openWhatsApp } from '@/utils/whatsapp';

/** Rows rendered at first, and added each time the end of the list comes near. */
const PAGE_SIZE = 50;

export default function CustomersScreen() {
  const { customers, loading, error, reload } = useCustomers();
  const searchText = useNativeState('');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  // Content height when the last page was added: add the next only once it's laid out
  const grownAt = useRef(-1);
  const hideTabBarOnScroll = useHideTabBarOnScrollModifiers((y, contentHeight, containerHeight) => {
    if (contentHeight === grownAt.current) return;
    if (contentHeight - (y + containerHeight) > containerHeight) return;
    grownAt.current = contentHeight;
    setLimit((n) => n + PAGE_SIZE);
  });

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
        {/* searchable only shows its field inside a NavigationStack, whose bar replaces the tab header */}
        <NavigationStack>
          <List
            modifiers={[
              navigationTitle('顧客資料'),
              listStyle('insetGrouped'),
              refreshable(() => reload(true)),
              scrollDismissesKeyboard('immediately'),
              ...hideTabBarOnScroll,
              searchable(searchText, {
                prompt: '搜尋姓名或電話',
                onChange: (text) => {
                  setQuery(text);
                  setLimit(PAGE_SIZE);
                },
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
                filtered.slice(0, limit).map((customer, index) => (
                  <CustomerRow
                    key={customer.id || `${customer.name}-${index}`}
                    customer={customer}
                  />
                ))
              )}
            </Section>
          </List>
        </NavigationStack>
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

// Memoized: cached customers keep their identity across reloads, so a
// search or reload only rebuilds the rows that changed
const CustomerRow = memo(function CustomerRow({ customer }: { customer: Customer }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const openDetails = (edit: boolean) =>
    router.push({
      pathname: '/customer-details',
      params: {
        ...(customer.id ? { id: customer.id, name: customer.name } : { name: customer.name }),
        ...(edit ? { edit: '1' } : {}),
      },
    });

  return (
    // An alert, not a confirmationDialog: on iOS 26 that opens as a popover
    // by the row and hides its 取消 button
    <Alert
      title="刪除顧客？"
      isPresented={confirmingDelete}
      onIsPresentedChange={setConfirmingDelete}
      // The row draws its own insets and background (CustomerRowContent)
      modifiers={[ownRowInsets]}
    >
      <Alert.Trigger>
        <ContextMenu>
          <ContextMenu.Items>
            <Button label="修改" systemImage="pencil" onPress={() => openDetails(true)} />
            <Button
              label="刪除"
              systemImage="trash"
              role="destructive"
              onPress={() => setConfirmingDelete(true)}
            />
          </ContextMenu.Items>
          <ContextMenu.Trigger>
            <CustomerRowContent customer={customer} onPress={() => openDetails(false)} />
          </ContextMenu.Trigger>
        </ContextMenu>
      </Alert.Trigger>
      <Alert.Actions>
        <Button label="取消" role="cancel" onPress={() => setConfirmingDelete(false)} />
        <Button
          label="刪除"
          role="destructive"
          onPress={() => {
            setConfirmingDelete(false);
            // Disappears at once and is sent in the background; a failure brings it back
            removeCustomer(customer);
          }}
        />
      </Alert.Actions>
      <Alert.Message>
        <Text>{`${customer.name}\n顧客的預約記錄會保留。刪除後無法復原。`}</Text>
      </Alert.Message>
    </Alert>
  );
});

/** Initial, name and phone. */
function CustomerSummary({ customer }: { customer: Customer }) {
  return (
    <HStack spacing={12}>
      <Text modifiers={[font({ size: 20, weight: 'bold' }), foregroundStyle(colors.accent)]}>
        {Array.from(customer.name)[0] ?? ''}
      </Text>
      <VStack spacing={2} alignment="leading">
        <Text modifiers={[font({ size: 16, weight: 'semibold' }), foregroundStyle(colors.text)]}>
          {customer.name}
        </Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle(colors.textSecondary)]}>
          {formatPhone(customer.phone) || '未有電話'}
        </Text>
      </VStack>
    </HStack>
  );
}

/**
 * The whole row, padded like a list row and with the list's row colour, so a
 * long press lifts all of it rather than a see-through cut-out of its text.
 */
function CustomerRowContent({ customer, onPress }: { customer: Customer; onPress: () => void }) {
  return (
    <HStack
      spacing={8}
      modifiers={[
        ...ownRowBackground(),
      ]}
    >
      <Button onPress={onPress} modifiers={[buttonStyle('plain')]}>
        <HStack spacing={12} modifiers={[contentShape(shapes.rectangle())]}>
          <CustomerSummary customer={customer} />
          <Spacer />
        </HStack>
      </Button>

      {customer.phone ? (
        <WhatsAppButton
          label={`用 WhatsApp 聯絡 ${customer.name}`}
          onPress={() => void openWhatsApp(customer.phone)}
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
        modifiers={[glassButton(), tint(colors.accent)]}
      />
    </HStack>
  );
}

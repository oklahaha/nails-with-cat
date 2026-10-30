/**
 * 統計 — SwiftUI Form dashboard with Swift Charts (`Chart`), split by a
 * segmented control into 總覽, 顧客 and (with fresh analysis results) 預測.
 * Calculations still from utils/stats.ts and utils/customerAnalytics.ts.
 */
import { Form, NavigationStack, Picker, Section, Text } from '@expo/ui/swift-ui';
import {
  listRowBackground,
  navigationTitle,
  pickerStyle,
  refreshable,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';

import { SwiftHost } from '@/components/swiftui/SwiftHost';
import { useHideTabBarOnScrollModifiers } from '@/components/swiftui/hideTabBarOnScroll';
import { SwiftStateView } from '@/components/swiftui/SwiftStateView';
import { CustomersTab } from '@/components/swiftui/stats/CustomersTab';
import { ForecastTab } from '@/components/swiftui/stats/ForecastTab';
import { OverviewTab } from '@/components/swiftui/stats/OverviewTab';
import { useAppointments } from '@/hooks/useAppointments';
import { useCustomerAnalytics } from '@/hooks/useCustomerAnalytics';
import { useCustomers } from '@/hooks/useCustomers';
import {
  atRiskCustomers,
  dueSoonCustomers,
  hasFreshAnalytics,
  recentWeeklyBookings,
  segmentSummary,
  visitDistribution,
} from '@/utils/customerAnalytics';
import { addMonths, todayIsoDate } from '@/utils/dates';
import {
  busyHeatmap,
  customerStats,
  lapsedCustomers,
  monthStats,
  recentMonths,
  serviceBreakdown,
  topCustomers,
  topCustomersShare,
} from '@/utils/stats';

const MONTH_COUNT = 12;
const LAPSED_MIN_VISITS = 2;
const LAPSED_MIN_DAYS = 42;
const TOP_LIMIT = 8;

type StatsTab = 'overview' | 'customers' | 'forecast';

export default function StatsScreen() {
  const today = todayIsoDate();
  const months = useMemo(() => recentMonths(MONTH_COUNT, today), [today]);
  const { appointments, loading, error, reload } = useAppointments({
    from: addMonths(today, 1 - MONTH_COUNT),
  });
  const { customers } = useCustomers();
  const { analytics, reload: reloadAnalytics } = useCustomerAnalytics();
  const [picked, setSelected] = useState(months[months.length - 1]);
  const selected = months.includes(picked) ? picked : months[months.length - 1];
  const [pickedTab, setTab] = useState<StatsTab>('overview');
  const hideTabBarOnScroll = useHideTabBarOnScrollModifiers();

  const monthly = useMemo(
    () => months.map((m) => monthStats(appointments, m, today)),
    [appointments, months, today]
  );
  const services = useMemo(
    () => serviceBreakdown(appointments, selected),
    [appointments, selected]
  );
  const heatmap = useMemo(() => busyHeatmap(appointments, today), [appointments, today]);
  const perCustomer = useMemo(() => customerStats(appointments, today), [appointments, today]);
  const top = useMemo(() => topCustomers(perCustomer, TOP_LIMIT), [perCustomer]);
  const topShare = useMemo(() => topCustomersShare(perCustomer, TOP_LIMIT), [perCustomer]);
  const lapsed = useMemo(
    () =>
      lapsedCustomers(
        perCustomer,
        { minVisits: LAPSED_MIN_VISITS, minDays: LAPSED_MIN_DAYS },
        today
      ),
    [perCustomer, today]
  );
  // Null when the nightly results are missing or stale: 久未回來 shows instead
  const insights = useMemo(() => {
    if (!hasFreshAnalytics(analytics, today)) return null;
    return {
      updatedAt: analytics.updatedAt,
      atRisk: atRiskCustomers(analytics, customers, appointments),
      dueSoon: dueSoonCustomers(analytics, customers, appointments, today),
      segments: segmentSummary(analytics),
      visitCounts: visitDistribution(analytics),
      totalClv: analytics.customers.reduce((sum, c) => sum + c.clv12m, 0),
      forecast: analytics.forecast,
    };
  }, [analytics, customers, appointments, today]);
  const recentAverage = useMemo(
    () => recentWeeklyBookings(appointments, today),
    [appointments, today]
  );

  if (loading) {
    return <SwiftStateView loading title="載入統計中…" systemImage="chart.bar" />;
  }

  if (error && appointments.length === 0) {
    return (
      <SwiftStateView
        title="未能載入統計"
        message={error}
        systemImage="exclamationmark.triangle"
        action={{ label: '重試', onPress: () => void reload() }}
      />
    );
  }

  const hasForecast = (insights?.forecast.length ?? 0) > 0;
  // Falls back if the results went stale while 預測 was showing
  const tab = pickedTab === 'forecast' && !hasForecast ? 'overview' : pickedTab;

  const openCustomer = (name: string) => {
    const customer = customers.find((c) => c.name === name);
    router.push({
      pathname: '/customer-details',
      params: customer?.id ? { id: customer.id, name } : { name },
    });
  };

  return (
    <SwiftHost>
      <NavigationStack>
        <Form
          modifiers={[
            navigationTitle('統計'),
            ...hideTabBarOnScroll,
            refreshable(async () => {
              await Promise.all([reload(true), reloadAnalytics()]);
            }),
          ]}
        >
          <Section modifiers={[listRowBackground('clear')]}>
            <Picker
              label="檢視"
              selection={tab}
              onSelectionChange={(value) => setTab(value as StatsTab)}
              modifiers={[pickerStyle('segmented')]}
            >
              <Text modifiers={[tag('overview')]}>總覽</Text>
              <Text modifiers={[tag('customers')]}>顧客</Text>
              {hasForecast ? <Text modifiers={[tag('forecast')]}>預測</Text> : null}
            </Picker>
          </Section>

          {tab === 'overview' ? (
            <OverviewTab
              months={months}
              monthly={monthly}
              selected={selected}
              onSelect={setSelected}
              services={services}
              heatmap={heatmap}
            />
          ) : null}
          {tab === 'customers' ? (
            <CustomersTab
              insights={insights}
              today={today}
              top={top}
              topShare={topShare}
              lapsed={lapsed}
              lapsedRule={`來過 ${LAPSED_MIN_VISITS} 次或以上、超過 ${LAPSED_MIN_DAYS / 7} 星期未來，亦未有預約`}
              onOpenCustomer={openCustomer}
            />
          ) : null}
          {tab === 'forecast' && insights ? (
            <ForecastTab
              forecast={insights.forecast}
              today={today}
              recentAverage={recentAverage}
              updatedAt={insights.updatedAt}
            />
          ) : null}
        </Form>
      </NavigationStack>
    </SwiftHost>
  );
}

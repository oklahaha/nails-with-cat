/**
 * 統計 — SwiftUI Form dashboard with Swift Charts (`Chart`).
 * Calculations still from utils/stats.ts.
 */
import {
  Button,
  Chart,
  Form,
  HStack,
  LabeledContent,
  NavigationStack,
  Section,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  contentShape,
  font,
  foregroundStyle,
  frame,
  labelStyle,
  navigationTitle,
  refreshable,
  shapes,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';

import { SwiftHost } from '@/components/swiftui/SwiftHost';
import { useHideTabBarOnScrollModifiers } from '@/components/swiftui/hideTabBarOnScroll';
import { SwiftStateView } from '@/components/swiftui/SwiftStateView';
import { glassButton } from '@/components/swiftui/glass';
import { WhatsAppButton } from '@/components/swiftui/WhatsAppButton';
import { serviceColor } from '@/constants/services';
import { colors } from '@/constants/theme';
import { useAppointments } from '@/hooks/useAppointments';
import { useCustomers } from '@/hooks/useCustomers';
import { addMonths, todayIsoDate, WEEKDAY_LABELS } from '@/utils/dates';
import {
  customerStats,
  formatMoney,
  lapsedCustomers,
  monthStats,
  recentMonths,
  serviceBreakdown,
  topCustomers,
  weekdayCounts,
  type CustomerStats,
} from '@/utils/stats';
import { openWhatsApp } from '@/utils/whatsapp';

const MONTH_COUNT = 12;
const LAPSED_MIN_VISITS = 2;
const LAPSED_MIN_DAYS = 42;
const LIST_LIMIT = 8;
/** The accent at ~35% over the dark row background, for the months that aren't selected. */
const ACCENT_FADED = '#674642';

export default function StatsScreen() {
  const today = todayIsoDate();
  const months = useMemo(() => recentMonths(MONTH_COUNT, today), [today]);
  const { appointments, loading, error, reload } = useAppointments({
    from: addMonths(today, 1 - MONTH_COUNT),
  });
  const { customers } = useCustomers();
  const [picked, setSelected] = useState(months[months.length - 1]);
  const selected = months.includes(picked) ? picked : months[months.length - 1];
  const [showAllLapsed, setShowAllLapsed] = useState(false);
  const hideTabBarOnScroll = useHideTabBarOnScrollModifiers();

  const monthly = useMemo(
    () => months.map((m) => monthStats(appointments, m, today)),
    [appointments, months, today]
  );
  const services = useMemo(
    () => serviceBreakdown(appointments, selected),
    [appointments, selected]
  );
  const weekdays = useMemo(() => weekdayCounts(appointments, today), [appointments, today]);
  const perCustomer = useMemo(() => customerStats(appointments, today), [appointments, today]);
  const top = useMemo(() => topCustomers(perCustomer, LIST_LIMIT), [perCustomer]);
  const lapsed = useMemo(
    () =>
      lapsedCustomers(
        perCustomer,
        { minVisits: LAPSED_MIN_VISITS, minDays: LAPSED_MIN_DAYS },
        today
      ),
    [perCustomer, today]
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

  const index = months.indexOf(selected);
  const current = monthly[index];
  const previous = index > 0 && index < months.length - 1 ? monthly[index - 1] : undefined;
  const isThisMonth = index === months.length - 1;

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
              await reload(true);
            }),
          ]}
        >

          <Section title="每月收入" footer={<Text>過去 12 個月 · 用上方 ‹ › 切換月份</Text>}>
            <HStack>
              <Button
                label="上個月"
                systemImage="chevron.left"
                onPress={() => index > 0 && setSelected(months[index - 1])}
                modifiers={[glassButton(), labelStyle('iconOnly')]}
              />
              <Spacer />
              <Text modifiers={[font({ size: 17, weight: 'semibold' })]}>
                {formatMonth(selected)}
              </Text>
              <Spacer />
              <Button
                label="下個月"
                systemImage="chevron.right"
                onPress={() => !isThisMonth && setSelected(months[index + 1])}
                modifiers={[glassButton(), labelStyle('iconOnly')]}
              />
            </HStack>
          </Section>

          <Section>
            <Chart
              type="bar"
              showGrid
              data={monthly.map((m) => ({
                x: `${Number(m.month.slice(5))}月`,
                y: m.revenue,
                color: m.month === selected ? colors.accent : ACCENT_FADED,
              }))}
              barStyle={{ cornerRadius: 3 }}
              modifiers={[frame({ height: 180 })]}
            />
          </Section>

          <Section title="本月概覽">
            <LabeledContent label="收入">
              <VStack alignment="trailing" spacing={2}>
                <Text modifiers={[font({ weight: 'bold' })]}>{formatMoney(current.revenue)}</Text>
                {changeLabel(current.revenue, previous?.revenue)}
              </VStack>
            </LabeledContent>
            <LabeledContent label="預約">
              <Text modifiers={[font({ weight: 'bold' })]}>{current.bookings}</Text>
            </LabeledContent>
            <LabeledContent label="顧客人數">
              <Text modifiers={[font({ weight: 'bold' })]}>{current.customers}</Text>
            </LabeledContent>
            <LabeledContent label="平均消費">
              <Text modifiers={[font({ weight: 'bold' })]}>
                {current.averageSpend != null ? formatMoney(current.averageSpend) : '—'}
              </Text>
            </LabeledContent>
            {isThisMonth && current.upcomingRevenue > 0 ? (
              <Text
                modifiers={[
                  font({ size: 12 }),
                  foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                ]}
              >
                另有 {formatMoney(current.upcomingRevenue)} 已預約
              </Text>
            ) : null}
          </Section>

          <Section title="服務分佈" footer={<Text>{formatMonth(selected)}</Text>}>
            {services.length === 0 ? (
              <Text
                modifiers={[
                  foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                ]}
              >
                這個月未有預約
              </Text>
            ) : (
              <>
                {/* Donut in the calendar's service colours; the rows below act as its legend */}
                <Chart
                  type="pie"
                  data={services.map((s) => ({
                    x: s.service,
                    y: s.bookings,
                    color: serviceColor(s.service),
                  }))}
                  pieStyle={{ innerRadius: 0.6, angularInset: 2, cornerRadius: 4, opacity: 1 }}
                  modifiers={[frame({ height: 180 })]}
                />
                {services.map((s) => (
                  <HStack key={s.service} spacing={8}>
                    <Text modifiers={[foregroundStyle(serviceColor(s.service))]}>●</Text>
                    <Text>{s.service}</Text>
                    <Spacer />
                    <Text
                      modifiers={[
                        foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                      ]}
                    >
                      {s.bookings} 次{s.revenue > 0 ? ` · ${formatMoney(s.revenue)}` : ''}
                    </Text>
                  </HStack>
                ))}
              </>
            )}
          </Section>

          <Section title="最繁忙日子" footer={<Text>過去 12 個月的來店次數</Text>}>
            <Chart
              type="bar"
              showGrid
              data={weekdays.map((count, i) => ({
                x: WEEKDAY_LABELS[i],
                y: count,
                color: count === Math.max(...weekdays) ? colors.accent : ACCENT_FADED,
              }))}
              barStyle={{ cornerRadius: 3 }}
              modifiers={[frame({ height: 140 })]}
            />
          </Section>

          <Section title="熟客排行" footer={<Text>過去 12 個月的消費</Text>}>
            {top.length === 0 ? (
              <Text
                modifiers={[
                  foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                ]}
              >
                未有記錄
              </Text>
            ) : (
              top.map((c, i) => (
                <CustomerStatRow
                  key={c.name}
                  customer={c}
                  rank={i + 1}
                  detail={`${c.visits} 次 · 最近 ${formatDay(c.lastVisit)}`}
                  value={formatMoney(c.spend)}
                  onPress={() => openCustomer(c.name)}
                />
              ))
            )}
          </Section>

          <Section
            title="久未回來"
            footer={
              <Text>
                來過 {LAPSED_MIN_VISITS} 次或以上、超過 {LAPSED_MIN_DAYS / 7} 星期未來，亦未有預約
              </Text>
            }
          >
            {lapsed.length === 0 ? (
              <Text
                modifiers={[
                  foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                ]}
              >
                熟客最近都有回來
              </Text>
            ) : (
              <>
                {(showAllLapsed ? lapsed : lapsed.slice(0, LIST_LIMIT)).map((c) => (
                  <CustomerStatRow
                    key={c.name}
                    customer={c}
                    detail={`上次 ${formatDay(c.lastVisit)} · ${c.lastService} · 共 ${c.visits} 次`}
                    value={`${c.daysSince} 日`}
                    onPress={() => openCustomer(c.name)}
                    showWhatsApp
                  />
                ))}
                {!showAllLapsed && lapsed.length > LIST_LIMIT ? (
                  <Button
                    label={`顯示全部 ${lapsed.length} 位`}
                    onPress={() => setShowAllLapsed(true)}
                    modifiers={[buttonStyle('plain'), tint(colors.accent)]}
                  />
                ) : null}
              </>
            )}
          </Section>
        </Form>
      </NavigationStack>
    </SwiftHost>
  );
}

function changeLabel(value: number, previous: number | undefined) {
  if (previous === undefined || previous === 0) return null;
  const pct = Math.round(((value - previous) / previous) * 100);
  const color = pct > 0 ? colors.success : pct < 0 ? colors.danger : colors.textSecondary;
  return (
    <Text modifiers={[font({ size: 12 }), foregroundStyle(color)]}>
      {pct > 0 ? '▲' : pct < 0 ? '▼' : '–'} {Math.abs(pct)}% 對上月
    </Text>
  );
}

function formatMonth(month: string): string {
  return `${month.slice(0, 4)}年${Number(month.slice(5))}月`;
}

function formatDay(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return m && d ? `${m}月${d}日` : iso;
}

function CustomerStatRow({
  customer,
  rank,
  detail,
  value,
  onPress,
  showWhatsApp,
}: {
  customer: CustomerStats;
  rank?: number;
  detail: string;
  value: string;
  onPress: () => void;
  showWhatsApp?: boolean;
}) {
  return (
    <HStack spacing={8}>
      <Button onPress={onPress} modifiers={[buttonStyle('plain')]}>
        <HStack spacing={8} modifiers={[contentShape(shapes.rectangle())]}>
          {rank != null ? (
            <Text
              modifiers={[
                font({ size: 13 }),
                foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
              ]}
            >
              {rank}
            </Text>
          ) : null}
          <VStack spacing={2} alignment="leading">
            <Text modifiers={[font({ weight: 'semibold' })]}>{customer.name}</Text>
            <Text
              modifiers={[
                font({ size: 12 }),
                foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
              ]}
            >
              {detail}
            </Text>
          </VStack>
          <Spacer />
          <Text modifiers={[font({ weight: 'semibold' })]}>{value}</Text>
        </HStack>
      </Button>
      {showWhatsApp && customer.phone ? (
        <WhatsAppButton
          label={`用 WhatsApp 聯絡 ${customer.name}`}
          onPress={() => void openWhatsApp(customer.phone!)}
        />
      ) : null}
    </HStack>
  );
}

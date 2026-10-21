/**
 * 統計 tab — a dashboard over the last 12 months of bookings: a month's
 * revenue and bookings, the 12-month revenue trend, services, busiest
 * weekdays, top customers, and regulars who haven't been back.
 */
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { StateView } from '@/components/StateView';
import { BarChart } from '@/components/stats/BarChart';
import { ServiceBreakdown } from '@/components/stats/ServiceBreakdown';
import { colors, pressedStyle, radius, spacing, type } from '@/constants/theme';
import { useAppointments } from '@/hooks/useAppointments';
import { useCustomers } from '@/hooks/useCustomers';
import { addMonths, todayIsoDate, WEEKDAY_LABELS } from '@/utils/dates';
import {
  customerStats,
  formatMoney,
  formatMoneyShort,
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
/** Regulars (this many visits) count as lapsed after this many days away. */
const LAPSED_MIN_VISITS = 2;
const LAPSED_MIN_DAYS = 42;
const LIST_LIMIT = 8;

export default function StatsScreen() {
  const today = todayIsoDate();
  const months = useMemo(() => recentMonths(MONTH_COUNT, today), [today]);
  // No end date, so future bookings are known (a lapsed regular may have rebooked)
  const { appointments, loading, refreshing, error, reload } = useAppointments({
    from: addMonths(today, 1 - MONTH_COUNT),
  });
  // Loaded so tapping a customer can open their details
  const { customers } = useCustomers();
  const [picked, setSelected] = useState(months[months.length - 1]);
  // Falls back to this month if the app stayed open into a new month
  const selected = months.includes(picked) ? picked : months[months.length - 1];

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
  const [showAllLapsed, setShowAllLapsed] = useState(false);

  if (loading) {
    return <StateView loading title="載入統計中…" />;
  }

  if (error && appointments.length === 0) {
    return (
      <StateView
        title="未能載入統計"
        message={error}
        tone="error"
        action={{ label: '重試', onPress: () => void reload() }}
      />
    );
  }

  const index = months.indexOf(selected);
  const current = monthly[index];
  // This month isn't over, so comparing it with a whole month would mislead
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void reload(true)}
          tintColor={colors.accent}
        />
      }
    >
      <View style={styles.monthNav}>
        <NavButton
          icon="chevronLeft"
          label="上個月"
          disabled={index <= 0}
          onPress={() => setSelected(months[index - 1])}
        />
        <Text style={styles.monthTitle}>{formatMonth(selected)}</Text>
        <NavButton
          icon="chevronRight"
          label="下個月"
          disabled={isThisMonth}
          onPress={() => setSelected(months[index + 1])}
        />
      </View>

      <View style={styles.tiles}>
        <Tile
          label="收入"
          value={formatMoney(current.revenue)}
          change={change(current.revenue, previous?.revenue)}
          note={
            isThisMonth && current.upcomingRevenue > 0
              ? `另有 ${formatMoney(current.upcomingRevenue)} 已預約`
              : undefined
          }
        />
        <Tile
          label="預約"
          value={`${current.bookings}`}
          change={change(current.bookings, previous?.bookings)}
        />
        <Tile label="顧客人數" value={`${current.customers}`} />
        <Tile
          label="平均消費"
          value={current.averageSpend != null ? formatMoney(current.averageSpend) : '—'}
        />
      </View>

      <Section title="每月收入" caption="過去 12 個月 · 點選查看該月">
        <BarChart
          bars={monthly.map((m) => ({
            key: m.month,
            label: `${Number(m.month.slice(5))}月`,
            value: m.revenue,
          }))}
          formatValue={formatMoneyShort}
          selectedKey={selected}
          onSelect={setSelected}
        />
      </Section>

      <Section title="服務分佈" caption={formatMonth(selected)}>
        {services.length > 0 ? (
          <ServiceBreakdown services={services} />
        ) : (
          <Text style={styles.empty}>這個月未有預約</Text>
        )}
      </Section>

      <Section title="最繁忙日子" caption="過去 12 個月的來店次數">
        <BarChart
          bars={weekdays.map((count, i) => ({
            key: String(i),
            label: WEEKDAY_LABELS[i],
            value: count,
          }))}
          formatValue={(n) => `${n} 次`}
          height={88}
        />
      </Section>

      <Section title="熟客排行" caption="過去 12 個月的消費">
        {top.length > 0 ? (
          top.map((c, i) => (
            <CustomerRow
              key={c.name}
              customer={c}
              rank={i + 1}
              detail={`${c.visits} 次 · 最近 ${formatDay(c.lastVisit)}`}
              value={formatMoney(c.spend)}
              divider={i > 0}
              onPress={() => openCustomer(c.name)}
            />
          ))
        ) : (
          <Text style={styles.empty}>未有記錄</Text>
        )}
      </Section>

      <Section
        title="久未回來"
        caption={`來過 ${LAPSED_MIN_VISITS} 次或以上、超過 ${LAPSED_MIN_DAYS / 7} 星期未來，亦未有預約`}
      >
        {lapsed.length > 0 ? (
          <>
            {(showAllLapsed ? lapsed : lapsed.slice(0, LIST_LIMIT)).map((c, i) => (
              <CustomerRow
                key={c.name}
                customer={c}
                detail={`上次 ${formatDay(c.lastVisit)} · ${c.lastService} · 共 ${c.visits} 次`}
                value={`${c.daysSince} 日`}
                divider={i > 0}
                onPress={() => openCustomer(c.name)}
                showWhatsApp
              />
            ))}
            {!showAllLapsed && lapsed.length > LIST_LIMIT ? (
              <Pressable
                onPress={() => setShowAllLapsed(true)}
                style={({ pressed }) => [styles.more, pressed && pressedStyle]}
                accessibilityRole="button"
              >
                <Text style={styles.link}>顯示全部 {lapsed.length} 位</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <Text style={styles.empty}>熟客最近都有回來 🎉</Text>
        )}
      </Section>
    </ScrollView>
  );
}

/** Percent change from the previous month; null when there's nothing to compare. */
function change(value: number, previous: number | undefined): number | null {
  if (previous === undefined || previous === 0) return null;
  return Math.round(((value - previous) / previous) * 100);
}

/** YYYY-MM → 2026年10月 */
function formatMonth(month: string): string {
  return `${month.slice(0, 4)}年${Number(month.slice(5))}月`;
}

/** YYYY-MM-DD → 9月3日 */
function formatDay(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return m && d ? `${m}月${d}日` : iso;
}

function NavButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'chevronLeft' | 'chevronRight';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.navBtn,
        pressed && pressedStyle,
        disabled && styles.navBtnDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon name={icon} color={colors.text} size={20} />
    </Pressable>
  );
}

function Tile({
  label,
  value,
  change,
  note,
}: {
  label: string;
  value: string;
  change?: number | null;
  note?: string;
}) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {change != null ? (
        <Text style={[styles.tileNote, change > 0 ? styles.up : change < 0 ? styles.down : null]}>
          {change > 0 ? '▲' : change < 0 ? '▼' : '–'} {Math.abs(change)}% 對上月
        </Text>
      ) : null}
      {note ? <Text style={styles.tileNote}>{note}</Text> : null}
    </View>
  );
}

function Section({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function CustomerRow({
  customer,
  rank,
  detail,
  value,
  divider,
  onPress,
  showWhatsApp,
}: {
  customer: CustomerStats;
  rank?: number;
  detail: string;
  value: string;
  divider: boolean;
  onPress: () => void;
  showWhatsApp?: boolean;
}) {
  const phone = customer.phone;
  // The WhatsApp button sits beside the tappable row, since buttons can't nest on web
  return (
    <View style={[styles.customerRow, divider && styles.divider]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.customerMain, pressed && pressedStyle]}
        accessibilityRole="button"
        accessibilityLabel={`${customer.name} ${detail} ${value}`}
      >
        {rank ? <Text style={styles.rank}>{rank}</Text> : null}
        <View style={styles.customerBody}>
          <Text style={styles.customerName} numberOfLines={1}>
            {customer.name}
          </Text>
          <Text style={styles.customerDetail} numberOfLines={1}>
            {detail}
          </Text>
        </View>
        <Text style={styles.customerValue}>{value}</Text>
      </Pressable>
      {showWhatsApp && phone ? (
        <Pressable
          onPress={() => void openWhatsApp(phone)}
          hitSlop={6}
          style={({ pressed }) => [styles.whatsappBtn, pressed && pressedStyle]}
          accessibilityRole="button"
          accessibilityLabel={`WhatsApp ${customer.name}`}
        >
          <Icon name="chat" color="#FFFFFF" size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  monthTitle: {
    ...type.heading,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  navBtnDisabled: {
    opacity: 0.3,
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    gap: 2,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  tileLabel: {
    ...type.label,
  },
  tileValue: {
    ...type.title,
    ...type.time,
    fontSize: 26,
  },
  tileNote: {
    ...type.caption,
    fontSize: 12,
  },
  up: {
    color: colors.success,
  },
  down: {
    color: colors.danger,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    ...type.heading,
  },
  sectionCaption: {
    ...type.caption,
    marginTop: 2,
  },
  card: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  empty: {
    ...type.caption,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  customerMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    paddingVertical: spacing.sm + 2,
  },
  rank: {
    ...type.label,
    ...type.time,
    width: 16,
    textAlign: 'center',
  },
  customerBody: {
    flex: 1,
    gap: 2,
  },
  customerName: {
    ...type.body,
    fontWeight: '600',
  },
  customerDetail: {
    ...type.caption,
    fontSize: 12,
  },
  customerValue: {
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
  more: {
    alignItems: 'center',
    paddingTop: spacing.sm + 4,
  },
  link: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
});

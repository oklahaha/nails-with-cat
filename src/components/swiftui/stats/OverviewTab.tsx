/** 統計 → 總覽: the picked month's numbers, then the year's trends and busy times. */
import {
  Button,
  Chart,
  HStack,
  Section,
  Spacer,
  Text,
  VStack,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  disabled,
  font,
  foregroundStyle,
  frame,
  labelStyle,
  monospacedDigit,
} from '@expo/ui/swift-ui/modifiers';

import { glassButton } from '@/components/swiftui/glass';
import { serviceColor } from '@/constants/services';
import { colors } from '@/constants/theme';
import { WEEKDAY_LABELS } from '@/utils/dates';
import {
  averageFullMonthRevenue,
  formatMoney,
  type BusyHeatmap as HeatmapData,
  type MonthStats,
  type ServiceStats,
} from '@/utils/stats';

import { BusyHeatmap } from './BusyHeatmap';
import { ACCENT_FADED, EmptyRow, SECONDARY, Stat } from './statsParts';

/** Symbol area in pt², so about a 5 pt dot. */
const LINE_POINT_SIZE = 24;

type Props = {
  months: string[];
  monthly: MonthStats[];
  selected: string;
  onSelect: (month: string) => void;
  services: ServiceStats[];
  heatmap: HeatmapData;
};

export function OverviewTab({ months, monthly, selected, onSelect, services, heatmap }: Props) {
  const index = months.indexOf(selected);
  const current = monthly[index];
  const isThisMonth = index === months.length - 1;
  // This month isn't over, so comparing it with a whole month would mislead
  const previous = index > 0 && !isThisMonth ? monthly[index - 1] : undefined;
  const average = averageFullMonthRevenue(monthly);
  const totalBookings = services.reduce((sum, s) => sum + s.bookings, 0);
  const label = (m: MonthStats) => `${Number(m.month.slice(5))}月`;

  return (
    <>
      <Section>
        <HStack>
          <Button
            label="上個月"
            systemImage="chevron.left"
            onPress={() => onSelect(months[index - 1])}
            modifiers={[glassButton(), labelStyle('iconOnly'), disabled(index <= 0)]}
          />
          <Spacer />
          <Text modifiers={[font({ size: 17, weight: 'semibold' })]}>{formatMonth(selected)}</Text>
          <Spacer />
          <Button
            label="下個月"
            systemImage="chevron.right"
            onPress={() => onSelect(months[index + 1])}
            modifiers={[glassButton(), labelStyle('iconOnly'), disabled(isThisMonth)]}
          />
        </HStack>
        <VStack spacing={2} alignment="leading" modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
          <Text modifiers={[font({ size: 13 }), SECONDARY]}>收入</Text>
          <Text modifiers={[font({ size: 36, weight: 'bold' }), monospacedDigit()]}>
            {formatMoney(current.revenue)}
          </Text>
          {changeLabel(current.revenue, previous?.revenue)}
          {isThisMonth && current.upcomingRevenue > 0 ? (
            <Text modifiers={[font({ size: 12 }), SECONDARY]}>
              另有 {formatMoney(current.upcomingRevenue)} 已預約
            </Text>
          ) : null}
        </VStack>
        <HStack>
          <Stat label="預約" value={current.bookings} rollOn={index} />
          <Stat label="顧客" value={current.customers} rollOn={index} />
          <Stat
            label="平均消費"
            value={current.averageSpend != null ? formatMoney(current.averageSpend) : '—'}
            rollOn={index}
          />
        </HStack>
      </Section>

      <Section
        title="每月收入"
        footer={
          <Text>
            過去 12 個月{average > 0 ? ` · 虛線為完整月份平均 ${formatMoney(average)}` : ''}
          </Text>
        }
      >
        <Chart
          type="bar"
          showGrid
          data={monthly.map((m) => ({
            x: label(m),
            y: m.revenue,
            color: m.month === selected ? colors.accent : ACCENT_FADED,
          }))}
          referenceLines={average > 0 ? [{ x: 'average', y: average }] : []}
          ruleStyle={{ color: colors.textSecondary, lineWidth: 1, dashArray: [4, 4] }}
          barStyle={{ cornerRadius: 3 }}
          modifiers={[frame({ height: 180 })]}
        />
      </Section>

      <Section title="走勢" footer={<Text>過去 12 個月，本月未完結</Text>}>
        <TrendChart
          title="每月預約"
          data={monthly.map((m) => ({ x: label(m), y: m.bookings }))}
        />
        <TrendChart
          title="平均消費"
          data={monthly.flatMap((m) =>
            m.averageSpend != null ? [{ x: label(m), y: m.averageSpend }] : []
          )}
        />
      </Section>

      <Section title="服務分佈" footer={<Text>{formatMonth(selected)}</Text>}>
        {services.length === 0 ? (
          <EmptyRow>這個月未有預約</EmptyRow>
        ) : (
          <>
            {/* Donut in the calendar's service colours; the rows below act as its legend */}
            <ZStack modifiers={[frame({ height: 180 })]}>
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
              <VStack spacing={0}>
                <Text modifiers={[font({ size: 24, weight: 'bold' }), monospacedDigit()]}>
                  {totalBookings}
                </Text>
                <Text modifiers={[font({ size: 12 }), SECONDARY]}>預約</Text>
              </VStack>
            </ZStack>
            {services.map((s) => (
              <HStack key={s.service} spacing={8}>
                <Text modifiers={[foregroundStyle(serviceColor(s.service))]}>●</Text>
                <Text>{s.service}</Text>
                <Spacer />
                <Text modifiers={[SECONDARY, monospacedDigit()]}>
                  {s.bookings} 次{s.revenue > 0 ? ` · ${formatMoney(s.revenue)}` : ''}
                </Text>
              </HStack>
            ))}
          </>
        )}
      </Section>

      <Section
        title="繁忙時段"
        footer={
          <Text>
            過去 12 個月按開始時間計的來店次數，顏色越濃越忙
            {heatmap.peak
              ? ` · 最忙：星期${WEEKDAY_LABELS[heatmap.peak.weekday]} ${heatmap.peak.band}`
              : ''}
          </Text>
        }
      >
        <BusyHeatmap heatmap={heatmap} />
      </Section>
    </>
  );
}

function TrendChart({ title, data }: { title: string; data: { x: string; y: number }[] }) {
  return (
    <VStack spacing={6} alignment="leading">
      <Text modifiers={[font({ size: 13 }), SECONDARY]}>{title}</Text>
      <Chart
        type="line"
        showGrid
        data={data}
        lineStyle={{ color: colors.accent, width: 2, pointStyle: 'circle', pointSize: LINE_POINT_SIZE }}
        modifiers={[frame({ height: 110 })]}
      />
    </VStack>
  );
}

function changeLabel(value: number, previous: number | undefined) {
  if (previous === undefined || previous === 0) return null;
  const pct = Math.round(((value - previous) / previous) * 100);
  const color = pct > 0 ? colors.success : pct < 0 ? colors.danger : colors.textSecondary;
  return (
    <Text modifiers={[font({ size: 13 }), foregroundStyle(color)]}>
      {pct > 0 ? '▲' : pct < 0 ? '▼' : '–'} {Math.abs(pct)}% 對上月
    </Text>
  );
}

function formatMonth(month: string): string {
  return `${month.slice(0, 4)}年${Number(month.slice(5))}月`;
}

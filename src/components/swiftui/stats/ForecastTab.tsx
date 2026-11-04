/** 統計 → 預測: the coming weeks' bookings and revenue, with how unsure they are. */
import { Chart, HStack, LabeledContent, Section, Text, VStack } from '@expo/ui/swift-ui';
import { font, frame, monospacedDigit } from '@expo/ui/swift-ui/modifiers';

import { colors, tint } from '@/constants/theme';
import type { ForecastWeek } from '@/types/customerAnalytics';
import { forecastSegments, nextForecastWeek } from '@/utils/customerAnalytics';
import { formatMoney } from '@/utils/stats';

import { formatDay, SECONDARY, Stat } from './statsParts';

/** How many weeks get a row of their own under the chart. */
const LISTED_WEEKS = 4;

/** Each stacked segment's fill; the gap under the range stays invisible. */
const SEGMENT_COLORS = {
  gap: '#00000000',
  range: tint(colors.accent, 0.35),
  tick: colors.accent,
};

type Props = {
  forecast: ForecastWeek[];
  today: string;
  /** Bookings per week lately, to compare with the forecast. */
  recentAverage: number;
  updatedAt: string | null;
};

export function ForecastTab({ forecast, today, recentAverage, updatedAt }: Props) {
  const next = nextForecastWeek(forecast, today);
  const ahead = forecast.filter((week) => week.weekStart > today);
  const totalRevenue = ahead.reduce((sum, week) => sum + week.revenue, 0);

  return (
    <>
      {next ? (
        <Section title={`下週（${formatDay(next.weekStart)} 起）`}>
          <VStack spacing={2} alignment="leading" modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
            <Text modifiers={[font({ size: 36, weight: 'bold' }), monospacedDigit()]}>
              {Math.round(next.bookings)} 個預約
            </Text>
            <Text modifiers={[font({ size: 13 }), SECONDARY]}>
              大概 {Math.round(next.bookingsLow)}–{Math.round(next.bookingsHigh)} 個
              {next.daysOff > 0 ? ` · 已知休息 ${next.daysOff} 日` : ''}
            </Text>
          </VStack>
          <HStack>
            <Stat label="下週收入" value={formatMoney(next.revenue)} />
            <Stat label={`未來 ${ahead.length} 週收入`} value={formatMoney(totalRevenue)} />
          </HStack>
        </Section>
      ) : null}

      <Section
        title="未來 12 週"
        footer={
          <Text>
            亮線為預計預約，淺色為 80% 可能範圍
            {recentAverage > 0 ? ` · 虛線為過去 8 週平均 ${recentAverage.toFixed(1)} 個` : ''}
          </Text>
        }
      >
        <Chart
          type="bar"
          showGrid
          data={forecastSegments(forecast).map((s) => ({
            x: s.x,
            y: s.y,
            color: SEGMENT_COLORS[s.kind],
          }))}
          referenceLines={recentAverage > 0 ? [{ x: 'recent', y: recentAverage }] : []}
          ruleStyle={{ color: colors.textSecondary, lineWidth: 1, dashArray: [4, 4] }}
          modifiers={[frame({ height: 200 })]}
        />
      </Section>

      <Section
        title="逐週"
        footer={
          <Text>
            只計做得到的預約，爆滿時推走的客人不計在內，實際需求可能更高 · 更新於 {updatedAt}
          </Text>
        }
      >
        {ahead.slice(0, LISTED_WEEKS).map((week) => (
          <LabeledContent key={week.weekStart} label={`${formatDay(week.weekStart)} 那週`}>
            <Text modifiers={[monospacedDigit()]}>
              {Math.round(week.bookings)} 個 · {formatMoney(week.revenue)}
              {week.daysOff > 0 ? ` · 休 ${week.daysOff} 日` : ''}
            </Text>
          </LabeledContent>
        ))}
      </Section>
    </>
  );
}

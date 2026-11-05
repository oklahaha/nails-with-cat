/**
 * 統計 → 洞察: what the nightly analysis found about the studio as a whole:
 * how often customers come back, which new customers stay, where revenue
 * comes from, what customers book next, how full the days are, and how far
 * to trust the predictions. Numbers come from the 分析摘要 tab
 * (utils/analysisSummary.ts); each chart has a plain-language summary for
 * VoiceOver, and every number its row too, so nothing rests on reading a chart.
 */
import { Chart, Gauge, HStack, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  font,
  foregroundStyle,
  frame,
  gaugeStyle,
  monospacedDigit,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { serviceColor } from '@/constants/services';
import { colors } from '@/constants/theme';
import {
  formatRate,
  SMALL_GROUP,
  type ModelCheck,
  type NewCustomerReturn,
  type NextServiceMix,
  type VisitRhythm,
  type WorkloadMonth,
} from '@/utils/analysisSummary';
import { formatPercent } from '@/utils/customerAnalytics';

import { SECONDARY, ShareBar, Stat } from './statsParts';

/** Symbol area in pt², as in 總覽's trend lines. */
const LINE_POINT_SIZE = 24;
const LEGEND_PER_LINE = 3;

function chunk<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));
}

export type Insights = {
  updatedAt: string | null;
  /** Plain-language sentences from the analysis, whatever it found tonight */
  findings: { topic: string; text: string }[];
  expectedReturns: number;
  rhythm: VisitRhythm[];
  newCustomers: NewCustomerReturn;
  revenueShares: { label: string; share: number; customers: number }[];
  nextServices: NextServiceMix[];
  workload: WorkloadMonth[];
  modelCheck: ModelCheck | null;
};

export function InsightsTab({ insights }: { insights: Insights }) {
  const { rhythm, newCustomers, revenueShares, nextServices, workload, modelCheck } = insights;
  const top20 = revenueShares.find((r) => r.label === '頭 20%');

  return (
    <>
      <Section footer={<Text>由每晚的分析計算 · 更新於 {insights.updatedAt}</Text>}>
        <HStack>
          <Stat label="60 日內預計回來" value={`${Math.round(insights.expectedReturns)} 位`} />
          <Stat
            label="新客回頭率"
            value={newCustomers.overall ? formatPercent(newCustomers.overall.value) : '—'}
          />
          <Stat label="頭 20% 顧客佔收入" value={top20 ? formatPercent(top20.share) : '—'} />
        </HStack>
      </Section>

      {insights.findings.length > 0 ? (
        <Section title="重點發現" footer={<Text>每晚由分析自動寫成，只在結果明顯時才說「明顯」</Text>}>
          {insights.findings.map((f) => (
            <VStack key={f.text} spacing={2} alignment="leading">
              <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(colors.accent)]}>
                {f.topic}
              </Text>
              <Text>{f.text}</Text>
            </VStack>
          ))}
        </Section>
      ) : null}

      {rhythm.length > 0 ? <RhythmSection rhythm={rhythm} /> : null}
      {newCustomers.byService.length > 0 ? <NewCustomerSection data={newCustomers} /> : null}
      {nextServices.length > 0 ? <NextServiceSection mixes={nextServices} /> : null}
      {revenueShares.length > 0 ? (
        <Section
          title="收入來自哪些顧客"
          footer={
            <Text>
              過去 12 個月 {revenueShares[0].customers} 位顧客的消費。少數熟客帶來大部分收入，所以「可能流失」按價值排先
            </Text>
          }
        >
          {revenueShares.map((r) => (
            <ShareBar key={r.label} label={`消費最多的${r.label}顧客`} share={r.share} />
          ))}
        </Section>
      ) : null}
      {workload.length > 0 ? <WorkloadSection months={workload} /> : null}
      {modelCheck ? <ModelCheckSection check={modelCheck} /> : null}
    </>
  );
}

function RhythmSection({ rhythm }: { rhythm: VisitRhythm[] }) {
  const summary = rhythm.map((r) => `${r.label}約 ${Math.round(r.value)} 日`).join('，');
  return (
    <Section
      title="回訪節奏"
      footer={<Text>兩次來店之間的日數中位數（括號內為 95% 可信範圍），已計及仍未回來的顧客</Text>}
    >
      <Chart
        type="bar"
        showGrid
        data={rhythm.map((r) => ({ x: r.label, y: r.value, color: serviceColor(r.label) }))}
        barStyle={{ cornerRadius: 3 }}
        modifiers={[frame({ height: 150 }), accessibilityLabel(`回訪日數：${summary}`)]}
      />
      {rhythm.map((r) => (
        <VStack key={r.label} spacing={2} alignment="leading">
          <HStack>
            <Text modifiers={[foregroundStyle(serviceColor(r.label))]}>●</Text>
            <Text>{r.label}</Text>
            <Spacer />
            <Text modifiers={[monospacedDigit()]}>
              約 {Math.round(r.value)} 日
              {r.low != null && r.high != null ? `（${Math.round(r.low)}–${Math.round(r.high)}）` : ''}
            </Text>
          </HStack>
          {r.neverReturn != null ? (
            <Text modifiers={[font({ size: 12 }), SECONDARY]}>
              每次做完，約 {formatPercent(r.neverReturn)} 之後沒有再來
            </Text>
          ) : null}
        </VStack>
      ))}
    </Section>
  );
}

function NewCustomerSection({ data }: { data: NewCustomerReturn }) {
  const summary = data.byService.map((r) => `${r.label} ${formatPercent(r.value)}`).join('，');
  return (
    <Section
      title="新客 60 日內回頭率"
      footer={
        <Text>
          按第一次做的服務，過去 2 年的新客。人數少的組別範圍很闊，只作參考。其他記錄（星期幾、時段、收費）都看不出分別
        </Text>
      }
    >
      <Chart
        type="bar"
        showGrid
        data={data.byService.map((r) => ({
          x: r.label,
          y: Math.round(r.value * 100),
          color: serviceColor(r.label),
        }))}
        barStyle={{ cornerRadius: 3 }}
        modifiers={[frame({ height: 150 }), accessibilityLabel(`新客回頭率（百分比）：${summary}`)]}
      />
      {data.byService.map((r) => (
        <RateRow key={r.label} label={`第一次做${r.label}`} item={r} color={serviceColor(r.label)} />
      ))}
      {data.bySource.length > 0 ? (
        <>
          <Text modifiers={[font({ size: 13, weight: 'semibold' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>
            按來源
          </Text>
          {data.bySource.map((r) => (
            <RateRow key={r.label} label={r.label} item={r} />
          ))}
        </>
      ) : null}
    </Section>
  );
}

function RateRow({
  label,
  item,
  color,
}: {
  label: string;
  item: { value: number; low: number | null; high: number | null; n: number };
  color?: string;
}) {
  return (
    <VStack spacing={2} alignment="leading">
      <HStack>
        {color ? <Text modifiers={[foregroundStyle(color)]}>●</Text> : null}
        <Text>{label}</Text>
        <Spacer />
        <Text modifiers={[monospacedDigit()]}>{formatRate(item)}</Text>
      </HStack>
      <Text modifiers={[font({ size: 12 }), SECONDARY]}>
        {item.n} 位新客{item.n < SMALL_GROUP ? ' · 人數少，僅供參考' : ''}
      </Text>
    </VStack>
  );
}

function NextServiceSection({ mixes }: { mixes: NextServiceMix[] }) {
  const legend = [...new Set(mixes.flatMap((m) => m.next.map((n) => n.service)))];
  const colorOf = (service: string) => (service === '其他' ? colors.textTertiary : serviceColor(service));
  const summary = mixes
    .map((m) => `${m.from}之後最多${m.next[0]?.service ?? ''} ${formatPercent(m.next[0]?.share ?? 0)}`)
    .join('，');
  return (
    <Section title="下次做甚麼" footer={<Text>做完每項服務後，同一位顧客下一次做的服務，過去 2 年</Text>}>
      {/* Bars sharing an x stack in Swift Charts: one 100% bar per service */}
      <Chart
        type="bar"
        data={mixes.flatMap((m) =>
          m.next.map((n) => ({ x: m.from, y: Math.round(n.share * 100), color: colorOf(n.service) }))
        )}
        barStyle={{ cornerRadius: 2 }}
        modifiers={[frame({ height: 180 }), accessibilityLabel(`下次做的服務：${summary}`)]}
      />
      {/* The legend, three to a line so it never runs off a small screen */}
      <VStack spacing={4} alignment="leading">
        {chunk(legend, LEGEND_PER_LINE).map((line) => (
          <HStack key={line.join()} spacing={10}>
            {line.map((service) => (
              <HStack key={service} spacing={3}>
                <Text modifiers={[font({ size: 11 }), foregroundStyle(colorOf(service))]}>●</Text>
                <Text modifiers={[font({ size: 11 }), SECONDARY]}>{service}</Text>
              </HStack>
            ))}
          </HStack>
        ))}
      </VStack>
      {mixes.map((m) => (
        <VStack key={m.from} spacing={2} alignment="leading">
          <HStack>
            <Text>{m.from}之後</Text>
            <Spacer />
            <Text modifiers={[font({ size: 12 }), SECONDARY, monospacedDigit()]}>{m.total} 次</Text>
          </HStack>
          <Text modifiers={[font({ size: 12 }), SECONDARY]}>
            {m.next
              .filter((n) => n.service !== '其他')
              .slice(0, 3)
              .map((n) => `${n.service} ${formatPercent(n.share)}`)
              .join(' · ')}
          </Text>
        </VStack>
      ))}
    </Section>
  );
}

function WorkloadSection({ months }: { months: WorkloadMonth[] }) {
  const latest = months[months.length - 1];
  return (
    <Section
      title="工作量"
      footer={
        <Text>
          有開工的日子平均預約了多少小時，及有幾多日同一時間有兩個預約。舊記錄的時長按服務預設計算
        </Text>
      }
    >
      <VStack spacing={6} alignment="leading">
        <HStack>
          <Text modifiers={[font({ size: 13 }), SECONDARY]}>每個開工日預約時數</Text>
          <Spacer />
          <Text modifiers={[font({ size: 13, weight: 'semibold' }), monospacedDigit()]}>
            {latest.label} {latest.hours.toFixed(1)} 小時
          </Text>
        </HStack>
        <Chart
          type="line"
          showGrid
          data={months.map((m) => ({ x: m.label, y: Math.round(m.hours * 10) / 10 }))}
          lineStyle={{ color: colors.accent, width: 2, pointStyle: 'circle', pointSize: LINE_POINT_SIZE }}
          modifiers={[
            frame({ height: 120 }),
            accessibilityLabel(`每個開工日預約時數，最近 ${latest.label} ${latest.hours.toFixed(1)} 小時`),
          ]}
        />
      </VStack>
      <VStack spacing={6} alignment="leading">
        <HStack>
          <Text modifiers={[font({ size: 13 }), SECONDARY]}>同時有兩個預約的日子</Text>
          <Spacer />
          <Text modifiers={[font({ size: 13, weight: 'semibold' }), monospacedDigit()]}>
            {latest.label} {formatPercent(latest.twoAtOnce)}
          </Text>
        </HStack>
        <Chart
          type="bar"
          showGrid
          data={months.map((m) => ({ x: m.label, y: Math.round(m.twoAtOnce * 100), color: colors.accent }))}
          barStyle={{ cornerRadius: 3 }}
          modifiers={[
            frame({ height: 110 }),
            accessibilityLabel(`同時有兩個預約的日子（百分比），最近 ${latest.label} ${formatPercent(latest.twoAtOnce)}`),
          ]}
        />
      </VStack>
    </Section>
  );
}

function ModelCheckSection({ check }: { check: ModelCheck }) {
  return (
    <Section
      title="預測有幾準"
      footer={
        <Text>
          用過去 6 個月檢查：每次只用當時已有的記錄估計，再對照顧客之後 60 日有沒有回來。「可能流失」及「快將回來」都是用這個估計
        </Text>
      }
    >
      <CheckRow
        label="估計會回來的顧客"
        share={check.expectedBack}
        detail={`實際 ${formatPercent(check.expectedBack)} 在 60 日內回來（${check.expectedBackCount} 人次）`}
      />
      <CheckRow
        label="估計不會回來的顧客"
        share={check.notExpectedBack}
        detail={`只有 ${formatPercent(check.notExpectedBack)} 在 60 日內回來（${check.notExpectedBackCount} 人次）`}
      />
    </Section>
  );
}

function CheckRow({ label, share, detail }: { label: string; share: number; detail: string }) {
  return (
    <VStack spacing={4} alignment="leading">
      <Text>{label}</Text>
      <Gauge value={share} modifiers={[gaugeStyle('linearCapacity'), tint(colors.accent)]} />
      <Text modifiers={[font({ size: 12 }), SECONDARY]}>{detail}</Text>
    </VStack>
  );
}

/**
 * 統計 → 顧客: who to contact, how customers split up, and who spends most.
 * Without fresh analysis results it's just 熟客排行 and the 久未回來 list.
 */
import { Button, Chart, Gauge, HStack, Image, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  contentShape,
  font,
  frame,
  gaugeStyle,
  monospacedDigit,
  shapes,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { router } from 'expo-router';
import { useState } from 'react';

import { colors } from '@/constants/theme';
import {
  formatPercent,
  type InsightRow,
  type SegmentSummary,
} from '@/utils/customerAnalytics';
import { daysBetween, formatMoney, type CustomerStats } from '@/utils/stats';

import { CustomerStatRow, EmptyRow, formatDay, SECONDARY, ShareBar, Stat } from './statsParts';

const LIST_LIMIT = 8;

export type CustomerInsights = {
  updatedAt: string | null;
  atRisk: InsightRow[];
  dueSoon: InsightRow[];
  segments: SegmentSummary[];
  visitCounts: { label: string; customers: number }[];
  totalClv: number;
};

type Props = {
  insights: CustomerInsights | null;
  /** 更新時間 of results too old to show, so the tab can say why the lists are missing */
  staleSince: string | null;
  /** New customers in the last 12 months per 來源 */
  sources: { sources: { source: string; customers: number }[]; unknown: number };
  today: string;
  top: CustomerStats[];
  /** The share of 12 months' spend held by `top`. */
  topShare: number;
  lapsed: (CustomerStats & { daysSince: number })[];
  lapsedRule: string;
  onOpenCustomer: (name: string) => void;
};

export function CustomersTab({
  insights,
  staleSince,
  sources,
  today,
  top,
  topShare,
  lapsed,
  lapsedRule,
  onOpenCustomer,
}: Props) {
  // One per list, so expanding one doesn't expand the other
  const [showAllAtRisk, setShowAllAtRisk] = useState(false);
  const [showAllDueSoon, setShowAllDueSoon] = useState(false);
  const [showAllLapsed, setShowAllLapsed] = useState(false);
  const oneVisit = insights?.visitCounts[0]?.customers ?? 0;
  const allCustomers = insights?.visitCounts.reduce((sum, b) => sum + b.customers, 0) ?? 0;

  const topSection = (
    <Section title="熟客排行" footer={<Text>過去 12 個月的消費</Text>}>
      {top.length === 0 ? (
        <EmptyRow>未有記錄</EmptyRow>
      ) : (
        <>
          <ShareBar label={`前 ${top.length} 位佔總收入`} share={topShare} />
          {top.map((c, i) => (
            <CustomerStatRow
              key={c.name}
              customer={c}
              rank={i + 1}
              detail={`${c.visits} 次 · 最近 ${formatDay(c.lastVisit)}`}
              value={formatMoney(c.spend)}
              onPress={() => onOpenCustomer(c.name)}
            />
          ))}
        </>
      )}
    </Section>
  );

  const sourceSection = <SourceSection sources={sources} />;

  if (!insights) {
    return (
      <>
        {staleSince ? (
          <Section>
            <Text modifiers={[font({ size: 13 }), SECONDARY]}>
              分析結果超過一星期未更新（上次 {staleSince}），暫時顯示久未回來的熟客。分析每晚 3 時自動執行。
            </Text>
          </Section>
        ) : null}
        {topSection}
        <Section title="久未回來" footer={<Text>{lapsedRule}</Text>}>
          {lapsed.length === 0 ? (
            <EmptyRow>熟客最近都有回來</EmptyRow>
          ) : (
            <>
              {(showAllLapsed ? lapsed : lapsed.slice(0, LIST_LIMIT)).map((c) => (
                <CustomerStatRow
                  key={c.name}
                  customer={c}
                  detail={`上次 ${formatDay(c.lastVisit)} · ${c.lastService} · 共 ${c.visits} 次`}
                  value={`${c.daysSince} 日`}
                  onPress={() => onOpenCustomer(c.name)}
                  showWhatsApp
                />
              ))}
              {!showAllLapsed && lapsed.length > LIST_LIMIT ? (
                <ShowAllButton count={lapsed.length} onPress={() => setShowAllLapsed(true)} />
              ) : null}
            </>
          )}
        </Section>
        {sourceSection}
      </>
    );
  }

  return (
    <>
      <Section footer={<Text>模型每晚更新 · 更新於 {insights.updatedAt}</Text>}>
        <HStack>
          <Stat label="可能流失" value={insights.atRisk.length} />
          <Stat label="快將回來" value={insights.dueSoon.length} />
          <Stat label="12 個月預計" value={formatMoney(insights.totalClv)} />
        </HStack>
      </Section>

      <Section
        title="可能流失"
        footer={<Text>模型估計 60 日內不太可能回來、未有預約的熟客，最有價值的排先</Text>}
      >
        {insights.atRisk.length === 0 ? (
          <EmptyRow>熟客最近都有回來</EmptyRow>
        ) : (
          <>
            {(showAllAtRisk ? insights.atRisk : insights.atRisk.slice(0, LIST_LIMIT)).map((c) => (
              <CustomerStatRow
                key={c.customerId}
                customer={c}
                detail={`${c.segment} · 上次 ${formatDay(c.lastVisit)} · 回來機率 ${formatPercent(c.pReturn60d)}`}
                value={`${daysBetween(c.lastVisit, today)} 日`}
                onPress={() => onOpenCustomer(c.name)}
                showWhatsApp
              />
            ))}
            {!showAllAtRisk && insights.atRisk.length > LIST_LIMIT ? (
              <ShowAllButton count={insights.atRisk.length} onPress={() => setShowAllAtRisk(true)} />
            ) : null}
          </>
        )}
      </Section>

      <Section title="快將回來" footer={<Text>預計 3 星期內回來、未有預約，可以先問候</Text>}>
        {insights.dueSoon.length === 0 ? (
          <EmptyRow>暫時未有</EmptyRow>
        ) : (
          <>
            {(showAllDueSoon ? insights.dueSoon : insights.dueSoon.slice(0, LIST_LIMIT)).map((c) => (
              <CustomerStatRow
                key={c.customerId}
                customer={c}
                detail={`上次 ${formatDay(c.lastVisit)} · 共 ${c.visits} 次 · 回來機率 ${formatPercent(c.pReturn60d)}`}
                value={formatDay(c.expectedNextVisit ?? '')}
                onPress={() => onOpenCustomer(c.name)}
                showWhatsApp
              />
            ))}
            {!showAllDueSoon && insights.dueSoon.length > LIST_LIMIT ? (
              <ShowAllButton count={insights.dueSoon.length} onPress={() => setShowAllDueSoon(true)} />
            ) : null}
          </>
        )}
      </Section>

      <Section title="顧客分群" footer={<Text>人數 · 佔未來 12 個月預計收入的比例 · 點選查看名單</Text>}>
        {insights.segments.map((s) => (
          <Button
            key={s.segment}
            onPress={() =>
              router.push({ pathname: '/segment-customers', params: { segment: s.segment } })
            }
            modifiers={[
              buttonStyle('plain'),
              accessibilityLabel(`${s.segment}，${s.customers} 位，查看名單`),
            ]}
          >
            <VStack spacing={4} alignment="leading" modifiers={[contentShape(shapes.rectangle())]}>
              <HStack spacing={8}>
                <Text>{s.segment}</Text>
                <Spacer />
                <Text modifiers={[SECONDARY, monospacedDigit()]}>
                  {s.customers} 位 · {formatPercent(s.clvShare)}
                </Text>
                <Image systemName="chevron.right" size={12} modifiers={[SECONDARY]} />
              </HStack>
              {s.description ? <Text modifiers={[font({ size: 12 }), SECONDARY]}>{s.description}</Text> : null}
              <Gauge value={s.clvShare} modifiers={[gaugeStyle('linearCapacity'), tint(colors.accent)]} />
            </VStack>
          </Button>
        ))}
      </Section>

      <Section
        title="來店次數"
        footer={
          <Text>
            每位顧客至今來過幾次
            {allCustomers > 0 ? ` · ${formatPercent(oneVisit / allCustomers)} 只來過一次` : ''}
          </Text>
        }
      >
        <Chart
          type="bar"
          showGrid
          data={insights.visitCounts.map((b) => ({
            x: b.label,
            y: b.customers,
            color: colors.accent,
          }))}
          barStyle={{ cornerRadius: 3 }}
          modifiers={[
            frame({ height: 150 }),
            accessibilityLabel(
              `來店次數：${insights.visitCounts.map((b) => `${b.label} ${b.customers} 位`).join('，')}`
            ),
          ]}
        />
      </Section>

      {topSection}
      {sourceSection}
    </>
  );
}

/** 新客來源: where the last 12 months' new customers came from (顧客's 來源). */
function SourceSection({ sources }: Pick<Props, 'sources'>) {
  const known = sources.sources.reduce((sum, s) => sum + s.customers, 0);
  return (
    <Section
      title="新客來源"
      footer={
        <Text>
          過去 12 個月新加入的顧客
          {sources.unknown > 0 ? ` · ${sources.unknown} 位未記錄來源` : ''}
          。新增顧客時揀選「來源」，分析便可比較哪個來源的新客較常回頭
        </Text>
      }
    >
      {known === 0 ? (
        <EmptyRow>未有記錄</EmptyRow>
      ) : (
        <Chart
          type="bar"
          showGrid
          data={sources.sources.map((s) => ({ x: s.source, y: s.customers, color: colors.accent }))}
          barStyle={{ cornerRadius: 3 }}
          modifiers={[
            frame({ height: 150 }),
            accessibilityLabel(
              `新客來源：${sources.sources.map((s) => `${s.source} ${s.customers} 位`).join('，')}`
            ),
          ]}
        />
      )}
    </Section>
  );
}

function ShowAllButton({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <Button
      label={`顯示全部 ${count} 位`}
      onPress={onPress}
      modifiers={[buttonStyle('plain'), tint(colors.accent)]}
    />
  );
}

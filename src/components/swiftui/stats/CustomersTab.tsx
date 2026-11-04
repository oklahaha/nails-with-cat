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

import { CustomerStatRow, EmptyRow, formatDay, SECONDARY, Stat } from './statsParts';

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
  today,
  top,
  topShare,
  lapsed,
  lapsedRule,
  onOpenCustomer,
}: Props) {
  const [showAll, setShowAll] = useState(false);
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

  if (!insights) {
    return (
      <>
        {topSection}
        <Section title="久未回來" footer={<Text>{lapsedRule}</Text>}>
          {lapsed.length === 0 ? (
            <EmptyRow>熟客最近都有回來</EmptyRow>
          ) : (
            <>
              {(showAll ? lapsed : lapsed.slice(0, LIST_LIMIT)).map((c) => (
                <CustomerStatRow
                  key={c.name}
                  customer={c}
                  detail={`上次 ${formatDay(c.lastVisit)} · ${c.lastService} · 共 ${c.visits} 次`}
                  value={`${c.daysSince} 日`}
                  onPress={() => onOpenCustomer(c.name)}
                  showWhatsApp
                />
              ))}
              {!showAll && lapsed.length > LIST_LIMIT ? (
                <ShowAllButton count={lapsed.length} onPress={() => setShowAll(true)} />
              ) : null}
            </>
          )}
        </Section>
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
            {(showAll ? insights.atRisk : insights.atRisk.slice(0, LIST_LIMIT)).map((c) => (
              <CustomerStatRow
                key={c.customerId}
                customer={c}
                detail={`${c.segment} · 上次 ${formatDay(c.lastVisit)} · 回來機率 ${formatPercent(c.pReturn60d)}`}
                value={`${daysBetween(c.lastVisit, today)} 日`}
                onPress={() => onOpenCustomer(c.name)}
                showWhatsApp
              />
            ))}
            {!showAll && insights.atRisk.length > LIST_LIMIT ? (
              <ShowAllButton count={insights.atRisk.length} onPress={() => setShowAll(true)} />
            ) : null}
          </>
        )}
      </Section>

      <Section title="快將回來" footer={<Text>預計 3 星期內回來、未有預約，可以先問候</Text>}>
        {insights.dueSoon.length === 0 ? (
          <EmptyRow>暫時未有</EmptyRow>
        ) : (
          insights.dueSoon.slice(0, LIST_LIMIT).map((c) => (
            <CustomerStatRow
              key={c.customerId}
              customer={c}
              detail={`上次 ${formatDay(c.lastVisit)} · 共 ${c.visits} 次`}
              value={formatDay(c.expectedNextVisit ?? '')}
              onPress={() => onOpenCustomer(c.name)}
              showWhatsApp
            />
          ))
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
          modifiers={[frame({ height: 150 })]}
        />
      </Section>

      {topSection}
    </>
  );
}

function ShareBar({ label, share }: { label: string; share: number }) {
  return (
    <VStack spacing={4} alignment="leading">
      <HStack>
        <Text modifiers={[font({ size: 13 }), SECONDARY]}>{label}</Text>
        <Spacer />
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), monospacedDigit()]}>
          {formatPercent(share)}
        </Text>
      </HStack>
      <Gauge value={share} modifiers={[gaugeStyle('linearCapacity'), tint(colors.accent)]} />
    </VStack>
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

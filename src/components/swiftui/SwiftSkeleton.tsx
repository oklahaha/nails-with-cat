/**
 * First-load placeholders shaped like the content they stand in for, drawn
 * inside the screen's own list or form, so its title, controls and search
 * field stay mounted and the real data drops into place without a jump.
 */
import { HStack, RoundedRectangle, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityElement,
  accessibilityHidden,
  accessibilityLabel,
  animation,
  Animation,
  font,
  foregroundStyle,
  frame,
  opacity,
  padding,
  redacted,
  type ModifierConfig,
} from '@expo/ui/swift-ui/modifiers';

import { colors } from '@/constants/theme';
import { useMotionAllowed } from '@/hooks/useReduceMotion';

const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
const block = foregroundStyle(colors.surfaceRaised);

/**
 * Redacted and slowly breathing unless Reduce Motion is on. `look` is hidden
 * from VoiceOver; `status` goes on one element per screen, read as 載入中.
 */
function usePlaceholder(): { look: ModifierConfig[]; status: ModifierConfig[] } {
  // Breathes only once Reduce Motion reads as off (static until then, which is
  // after the first draw, as SwiftUI only animates a value that changes), and
  // follows the setting while it shows
  const breathe = useMotionAllowed();
  // The same modifiers either way (changing the list rebuilds the view): a slow
  // native breath with no JS timer, or one short fade back when Reduce Motion turns on
  const pulse = [
    opacity(breathe ? 0.5 : 1),
    animation(
      breathe
        ? Animation.easeInOut({ duration: 1 }).repeat({ repeatCount: 1000, autoreverses: true })
        : Animation.easeInOut({ duration: 0.2 }),
      breathe
    ),
  ];
  return {
    look: [redacted('placeholder'), accessibilityHidden(true), ...pulse],
    status: [redacted('placeholder'), accessibilityElement('ignore'), accessibilityLabel('載入中'), ...pulse],
  };
}

/** 預約資料 / 顧客資料: sections of rows like the real ones, for an inset grouped List. */
export function ListSkeleton({ rows }: { rows: 'appointment' | 'customer' }) {
  const { look, status } = usePlaceholder();
  const sections = rows === 'appointment' ? [3, 2, 2] : [9];
  return (
    <>
      {sections.map((count, s) => (
        <Section
          key={s}
          header={<Text modifiers={[font({ size: 12 }), secondary, ...(s === 0 ? status : look)]}>11月27日 星期五</Text>}
        >
          {Array.from({ length: count }, (_, i) =>
            rows === 'appointment' ? (
              <HStack key={i} spacing={10} modifiers={[padding({ vertical: 4 }), ...look]}>
                <VStack spacing={2} alignment="leading" modifiers={[padding({ trailing: 4 })]}>
                  <Text modifiers={[font({ size: 16, weight: 'bold' })]}>10:00</Text>
                  <Text modifiers={[font({ size: 13 })]}>12:00</Text>
                </VStack>
                <VStack spacing={3} alignment="leading">
                  <Text modifiers={[font({ size: 17, weight: 'semibold' })]}>
                    {i % 2 ? '顧客姓名' : '顧客的姓名'}
                  </Text>
                  <Text modifiers={[font({ size: 14 })]}>{i % 2 ? '眼睫毛 · $428' : '整甲 · 手 · $218'}</Text>
                </VStack>
                <Spacer />
              </HStack>
            ) : (
              <HStack key={i} spacing={12} modifiers={look}>
                <Text modifiers={[font({ size: 20, weight: 'bold' })]}>陳</Text>
                <VStack spacing={2} alignment="leading">
                  <Text modifiers={[font({ size: 16, weight: 'semibold' })]}>
                    {i % 3 ? '顧客姓名' : '顧客的姓名'}
                  </Text>
                  <Text modifiers={[font({ size: 13 })]}>9123 4567</Text>
                </VStack>
                <Spacer />
                <Text modifiers={[font({ size: 15 })]}>預約</Text>
              </HStack>
            )
          )}
        </Section>
      ))}
    </>
  );
}

/** 作品: a month header and rows of square tiles, below the screen's filter. */
export function GallerySkeleton({ tile, gap }: { tile: number; gap: number }) {
  const { look, status } = usePlaceholder();
  return (
    <VStack spacing={gap} alignment="leading">
      <HStack modifiers={[padding({ horizontal: 16, top: 14, bottom: 6 }), ...status]}>
        <Text modifiers={[font({ size: 17, weight: 'semibold' })]}>2026年11月</Text>
        <Spacer />
        <Text modifiers={[font({ size: 13 })]}>12 張</Text>
      </HStack>
      {Array.from({ length: 5 }, (_, r) => (
        <HStack key={r} spacing={gap} modifiers={look}>
          {Array.from({ length: 3 }, (_, c) => (
            <RoundedRectangle key={c} cornerRadius={0} modifiers={[block, frame({ width: tile, height: tile })]} />
          ))}
        </HStack>
      ))}
    </VStack>
  );
}

const BAR_HEIGHTS = [0.45, 0.6, 0.5, 0.7, 0.55, 0.8, 0.65, 0.9, 0.6, 0.75, 0.85, 0.5];

/**
 * 統計, below the screen's picker: 總覽's month numbers, monthly bars and
 * trends, or for the other tabs a chart over a list.
 */
export function StatsSkeleton({ overview }: { overview: boolean }) {
  const { look, status } = usePlaceholder();
  if (!overview) {
    return (
      <>
        <Section>
          <VStack spacing={12} alignment="leading" modifiers={status}>
            <Text modifiers={[font({ size: 15, weight: 'semibold' })]}>顧客分析</Text>
            <RoundedRectangle cornerRadius={8} modifiers={[block, frame({ maxWidth: Infinity, minHeight: 160, maxHeight: 160 })]} />
          </VStack>
        </Section>
        <Section>
          {Array.from({ length: 5 }, (_, i) => (
            <HStack key={i} modifiers={look}>
              <Text>{i % 2 ? '顧客姓名' : '顧客的姓名'}</Text>
              <Spacer />
              <Text>$1,234</Text>
            </HStack>
          ))}
        </Section>
      </>
    );
  }
  return (
    <>
      <Section>
        <VStack spacing={12} alignment="leading" modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), ...status]}>
          <Text modifiers={[font({ size: 17, weight: 'semibold' })]}>2026年11月</Text>
          <Text modifiers={[font({ size: 13 })]}>收入</Text>
          <Text modifiers={[font({ size: 36, weight: 'bold' })]}>$12,345</Text>
          <HStack>
            {['預約', '顧客', '平均消費'].map((label) => (
              <VStack key={label} spacing={2} alignment="leading" modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
                <Text modifiers={[font({ size: 13 })]}>{label}</Text>
                <Text modifiers={[font({ size: 22, weight: 'bold' })]}>88</Text>
              </VStack>
            ))}
          </HStack>
        </VStack>
      </Section>
      <Section title="每月收入">
        <HStack spacing={6} alignment="bottom" modifiers={[frame({ height: 180 }), ...look]}>
          {BAR_HEIGHTS.map((h, i) => (
            <RoundedRectangle
              key={i}
              cornerRadius={3}
              modifiers={[block, frame({ maxWidth: Infinity, minHeight: 170 * h, maxHeight: 170 * h })]}
            />
          ))}
        </HStack>
      </Section>
      <Section title="走勢">
        {['每月預約', '平均消費'].map((label) => (
          <VStack key={label} spacing={8} alignment="leading" modifiers={look}>
            <Text modifiers={[font({ size: 15, weight: 'semibold' })]}>{label}</Text>
            <RoundedRectangle cornerRadius={8} modifiers={[block, frame({ maxWidth: Infinity, minHeight: 90, maxHeight: 90 })]} />
          </VStack>
        ))}
      </Section>
    </>
  );
}

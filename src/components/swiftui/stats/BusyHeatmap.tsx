import { HStack, RoundedRectangle, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, monospacedDigit } from '@expo/ui/swift-ui/modifiers';

import { colors, tint } from '@/constants/theme';
import { WEEKDAY_LABELS } from '@/utils/dates';
import type { BusyHeatmap as HeatmapData } from '@/utils/stats';

import { SECONDARY } from './statsParts';

const LABEL_WIDTH = 44;
const CELL_HEIGHT = 30;
/** Above this share of the busiest cell, dark text reads better on the accent. */
const DARK_TEXT_FROM = 0.6;

/**
 * Visits by weekday and start time, drawn with shapes: Swift Charts' rectangle
 * marks here only take a numeric y. Every cell has its number, so nothing
 * depends on telling the shades apart.
 */
export function BusyHeatmap({ heatmap }: { heatmap: HeatmapData }) {
  return (
    <VStack spacing={3}>
      <HStack spacing={3}>
        <Text modifiers={[frame({ width: LABEL_WIDTH })]}> </Text>
        {WEEKDAY_LABELS.map((day) => (
          <Text key={day} modifiers={[font({ size: 12 }), SECONDARY, frame({ maxWidth: Infinity })]}>
            {day}
          </Text>
        ))}
      </HStack>
      {heatmap.bands.map((band, i) => (
        <HStack key={band} spacing={3}>
          <Text modifiers={[font({ size: 11 }), SECONDARY, frame({ width: LABEL_WIDTH, alignment: 'leading' })]}>
            {band}
          </Text>
          {heatmap.counts[i].map((count, weekday) => (
            <Cell key={weekday} count={count} share={heatmap.max > 0 ? count / heatmap.max : 0} />
          ))}
        </HStack>
      ))}
    </VStack>
  );
}

function Cell({ count, share }: { count: number; share: number }) {
  const fill = count === 0 ? colors.surfaceRaised : tint(colors.accent, 0.15 + share * 0.85);
  return (
    <ZStack modifiers={[frame({ maxWidth: Infinity, minHeight: CELL_HEIGHT, maxHeight: CELL_HEIGHT })]}>
      <RoundedRectangle cornerRadius={5} modifiers={[foregroundStyle(fill)]} />
      {count > 0 ? (
        <Text
          modifiers={[
            font({ size: 11, weight: 'medium' }),
            monospacedDigit(),
            foregroundStyle(share >= DARK_TEXT_FROM ? colors.onAccent : colors.text),
          ]}
        >
          {count}
        </Text>
      ) : null}
    </ZStack>
  );
}

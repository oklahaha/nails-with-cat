/**
 * Sizes for the iOS month grid, which shows every booking without scrolling.
 * A week gets the height its busiest day needs, with what's left shared
 * equally, and in a month too busy to fit, every chip shrinks to make room.
 */
export const WEEKDAY_ROW_HEIGHT = 32;
/** Day number and the space around it. */
const WEEK_BASE_HEIGHT = 34;
/** The grid lines between the weeks. */
const LINES_HEIGHT = 3;
/** Tall enough that the floating add button never covers a day. */
const FOOTER_MIN_HEIGHT = 66;
const LEGEND_ROW_HEIGHT = 15;
export const LEGEND_ROW_GAP = 4;
const LEGEND_PADDING = 16;

const CHIP_HEIGHT = 15;
const CHIP_GAP = 2;
const CHIP_FONT_SIZE = 10;
/** Below this a chip is only a coloured bar: the text would be unreadable. */
const MIN_FONT_SIZE = 7;
/** Top and bottom space a chip's text needs. */
const CHIP_TEXT_INSET = 3;

export type MonthLayout = {
  weekHeights: number[];
  footerHeight: number;
  chipHeight: number;
  chipGap: number;
  /** 0 when the chips are too small for text. */
  fontSize: number;
};

/**
 * @param height the space the whole month has, weekday row and legend included
 * @param chipsPerWeek the most bookings on one day, for each week
 * @param legendRows rows of services in the legend
 */
export function layoutMonth(height: number, chipsPerWeek: number[], legendRows: number): MonthLayout {
  const legendHeight =
    LEGEND_PADDING + legendRows * LEGEND_ROW_HEIGHT + Math.max(legendRows - 1, 0) * LEGEND_ROW_GAP;
  const footerHeight = Math.max(FOOTER_MIN_HEIGHT, legendHeight);

  const available = height - WEEKDAY_ROW_HEIGHT - footerHeight - LINES_HEIGHT;
  const forChips = Math.max(available - chipsPerWeek.length * WEEK_BASE_HEIGHT, 0);
  const totalChips = chipsPerWeek.reduce((sum, chips) => sum + chips, 0);

  const fullSize = CHIP_HEIGHT + CHIP_GAP;
  const eachChip = totalChips > 0 ? Math.min(forChips / totalChips, fullSize) : fullSize;
  const spare = forChips - totalChips * eachChip;

  const weekHeights = chipsPerWeek.map(
    (chips) => WEEK_BASE_HEIGHT + chips * eachChip + spare / chipsPerWeek.length,
  );

  const chipGap = eachChip < fullSize ? Math.min(CHIP_GAP, eachChip / 8) : CHIP_GAP;
  const chipHeight = eachChip - chipGap;
  const fitted = Math.min(CHIP_FONT_SIZE, chipHeight - CHIP_TEXT_INSET);

  return {
    weekHeights,
    footerHeight,
    chipHeight,
    chipGap,
    fontSize: fitted >= MIN_FONT_SIZE ? fitted : 0,
  };
}

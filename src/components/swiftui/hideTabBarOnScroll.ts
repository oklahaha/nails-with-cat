/**
 * Modifiers for a SwiftUI List / Form / ScrollView that hide the tab bar while
 * scrolling down and show it on scroll up. Spread them into `modifiers`.
 * Needs iOS 18+ (no-ops below).
 *
 * Only offsets that change while the user is dragging or flinging count, so
 * the list moving because the bar's safe area went away can't toggle it back.
 * `onScroll` also gets every offset, for screens that need it themselves.
 */
import { onScrollPhaseChange, useScrollGeometryChange } from '@expo/ui/swift-ui/modifiers';

import { useHideTabBarOnScroll } from '@/hooks/useTabBarVisibility';

export function useHideTabBarOnScrollModifiers(
  onScroll?: (y: number, contentHeight: number, containerHeight: number) => void,
) {
  const { onScrollOffset, setUserScrolling } = useHideTabBarOnScroll();
  const geometry = useScrollGeometryChange((g) => {
    onScrollOffset(g.contentOffsetY, g.contentHeight, g.containerHeight);
    onScroll?.(g.contentOffsetY, g.contentHeight, g.containerHeight);
  })!;
  const phase = onScrollPhaseChange((p) =>
    setUserScrolling(p === 'tracking' || p === 'interacting' || p === 'decelerating'),
  );
  return [geometry, phase];
}

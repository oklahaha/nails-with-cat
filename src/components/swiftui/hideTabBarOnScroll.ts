/**
 * Modifiers for a SwiftUI List / Form / ScrollView that hide the tab bar while
 * scrolling down and show it on scroll up. Spread them into `modifiers`.
 * Needs iOS 18+ (no-ops below).
 *
 * Only offsets that change while the user is dragging or flinging count, so
 * the list moving because the bar's safe area went away can't toggle it back.
 * `onScroll` also gets every offset, for screens that need it themselves.
 * With `enabled: false` (a loading placeholder) nothing reacts, but the
 * modifiers stay, since changing a view's modifier list rebuilds it.
 */
import { onScrollPhaseChange, useScrollGeometryChange } from '@expo/ui/swift-ui/modifiers';

import { useHideTabBarOnScroll } from '@/hooks/useTabBarVisibility';

type Options = {
  enabled?: boolean;
  onScroll?: (y: number, contentHeight: number, containerHeight: number) => void;
};

export function useHideTabBarOnScrollModifiers({ enabled = true, onScroll }: Options = {}) {
  const { onScrollOffset, setUserScrolling } = useHideTabBarOnScroll(enabled);
  const geometry = useScrollGeometryChange((g) => {
    // Always passed on: while disabled it only records where the view is
    onScrollOffset(g.contentOffsetY, g.contentHeight, g.containerHeight);
    if (enabled) onScroll?.(g.contentOffsetY, g.contentHeight, g.containerHeight);
  })!;
  // Recorded while disabled too (it moves nothing), so a drag that began on a
  // loading placeholder still counts once the real content is in
  const phase = onScrollPhaseChange((p) =>
    setUserScrolling(p === 'tracking' || p === 'interacting' || p === 'decelerating'),
  );
  return [geometry, phase];
}

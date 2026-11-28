/**
 * Hides the bottom tab bar while the user scrolls down and shows it again as
 * soon as they scroll up (or reach the top). The tab layouts wrap their tabs
 * in TabBarVisibilityProvider and read `hidden`; screens report their scroll
 * offset through useHideTabBarOnScroll.
 *
 * On Android and web, SlidingTabBar floats over the screens and drives
 * `progress` (0 shown → 1 hidden), so the ＋ button can slide with it; screens
 * pad their scroll content by useTabBarInset(). On iOS the native bar does its
 * own animation and the inset stays 0.
 */
import { useFocusEffect } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

/** Points scrolled in one direction before the tab bar toggles, so small jitters don't flicker it. */
const THRESHOLD = 12;

type TabBarLayout = {
  setHidden: (hidden: boolean) => void;
  /** Whether the bar is hidden now, whoever hid or showed it. */
  isHidden: () => boolean;
  /** Height of the floating tab bar (Android, web); 0 on iOS. */
  inset: number;
  setInset: (inset: number) => void;
  progress: Animated.Value;
};

/**
 * `hidden` has its own context: it flips on every scroll direction change,
 * and only the tab bar itself needs to re-render for it, not the screens.
 */
const TabBarHiddenContext = createContext(false);

const TabBarLayoutContext = createContext<TabBarLayout>({
  setHidden: () => {},
  isHidden: () => false,
  inset: 0,
  setInset: () => {},
  progress: new Animated.Value(0),
});

export function TabBarVisibilityProvider({ children }: { children: ReactNode }) {
  const [hidden, setHiddenState] = useState(false);
  const hiddenNow = useRef(false);
  const [inset, setInset] = useState(0);
  const [progress] = useState(() => new Animated.Value(0));
  const layout = useMemo(
    () => ({
      setHidden: (next: boolean) => {
        hiddenNow.current = next;
        setHiddenState(next);
      },
      isHidden: () => hiddenNow.current,
      inset,
      setInset,
      progress,
    }),
    [inset, progress]
  );
  return (
    <TabBarLayoutContext.Provider value={layout}>
      <TabBarHiddenContext.Provider value={hidden}>{children}</TabBarHiddenContext.Provider>
    </TabBarLayoutContext.Provider>
  );
}

/** Everything but `hidden`, so callers don't re-render when the bar toggles. */
export function useTabBarLayout() {
  return useContext(TabBarLayoutContext);
}

export function useTabBarHidden() {
  return useContext(TabBarHiddenContext);
}

/** Bottom padding scroll content needs so its end isn't covered by the floating tab bar. */
export function useTabBarInset() {
  return useContext(TabBarLayoutContext).inset;
}

/**
 * Returns `onScrollOffset(y, contentHeight, containerHeight)` for SwiftUI scroll
 * geometry, `setUserScrolling` for SwiftUI scroll phases, and `scrollHandlers`
 * to spread onto a React Native scroll view. Shows the tab bar again when the
 * screen gains or loses focus, or unmounts (e.g. leaving the timetable's
 * Day/Week grid for Month).
 */
/** `enabled: false` (an offscreen or loading view) leaves the bar alone, focus included. */
export function useHideTabBarOnScroll(enabled = true) {
  const { setHidden, isHidden } = useContext(TabBarLayoutContext);
  const anchor = useRef(0);
  // Web scroll views don't report drags, and the floating bar never resizes them.
  const userScrolling = useRef(Platform.OS === 'web');
  const size = useRef({ content: 0, container: 0 });
  // Kept while disabled too, so a view that becomes active again (a timetable
  // page swiped back to, still scrolled) measures from where it really is
  const lastY = useRef(0);
  // Only the focused screen's scrolling moves the bar: a late event from one
  // just left mustn't undo what the new screen shows
  const focused = useRef(false);

  // Always the shared state, no copy per scroll view: another page or screen may
  // have shown the bar since (React skips a value that's unchanged)
  const update = setHidden;

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      if (enabled) {
        anchor.current = lastY.current;
        update(false);
      }
      return () => {
        focused.current = false;
        if (enabled) update(false);
      };
    }, [update, enabled]),
  );

  const onScrollOffset = useCallback(
    (y: number, contentHeight: number, containerHeight: number) => {
      const last = size.current;
      const resized = last.content !== contentHeight || last.container !== containerHeight;
      size.current = { content: contentHeight, container: containerHeight };
      lastY.current = y;
      if (!enabled || !focused.current) return;

      if (y <= 0) {
        anchor.current = 0;
        update(false);
        return;
      }
      // Offsets that move because the layout changed (e.g. the bar itself hiding,
      // or the list clamping at its end) aren't the user scrolling: re-anchor only,
      // so showing/hiding the bar can't feed back into another toggle.
      const maxY = Math.max(0, contentHeight - containerHeight);
      if (resized || !userScrolling.current || y > maxY) {
        anchor.current = Math.min(y, maxY);
        return;
      }

      const delta = y - anchor.current;
      if (delta > THRESHOLD) {
        anchor.current = y;
        update(true);
      } else if (delta < -THRESHOLD) {
        anchor.current = y;
        update(false);
      } else if ((delta > 0 && isHidden()) || (delta < 0 && !isHidden())) {
        // Still moving the same way: keep the anchor at the furthest point.
        anchor.current = y;
      }
    },
    [update, isHidden, enabled],
  );

  const setUserScrolling = useCallback((scrolling: boolean) => {
    if (Platform.OS !== 'web') userScrolling.current = scrolling;
  }, []);

  const scrollHandlers = useMemo(() => {
    const start = () => setUserScrolling(true);
    const stop = () => setUserScrolling(false);
    return {
      onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        onScrollOffset(contentOffset.y, contentSize.height, layoutMeasurement.height);
      },
      onScrollBeginDrag: start,
      onMomentumScrollBegin: start,
      // A drag without a fling ends here; with a fling, momentum events follow.
      onScrollEndDrag: stop,
      onMomentumScrollEnd: stop,
      scrollEventThrottle: 16,
    };
  }, [onScrollOffset, setUserScrolling]);

  return { onScrollOffset, setUserScrolling, scrollHandlers };
}

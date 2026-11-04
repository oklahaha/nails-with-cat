import { useMemo, useState } from 'react';
import { Animated, PanResponder } from 'react-native';

/** How far (points) or how fast (points/ms) a release has to be to turn the page. */
const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 0.5;

/**
 * Horizontal swipes that page the timetable: finger to the left shows the
 * next page, to the right the previous one, as in iOS Calendar. Only clearly
 * horizontal drags count, so vertical scrolling and taps work as before.
 * Spread `panHandlers` onto the content's View and give it `style`, which
 * follows the finger a little and slides the new page in.
 */
export function useSwipePaging(onSwipe: (direction: 1 | -1) => void) {
  const [translateX] = useState(() => new Animated.Value(0));

  // Remade only when `onSwipe` changes, so keep it stable (useCallback) between pages
  const panResponder = useMemo(() => {
    const settle = () =>
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    return PanResponder.create({
      // Capture, so a drag that starts on a day cell or booking still pages
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => translateX.setValue(g.dx * 0.4),
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) < SWIPE_DISTANCE && Math.abs(g.vx) < SWIPE_VELOCITY) {
          settle();
          return;
        }
        const direction = g.dx < 0 ? 1 : -1;
        onSwipe(direction);
        // The new page comes in from the side the finger moved away from
        translateX.setValue(direction * SWIPE_DISTANCE);
        settle();
      },
      onPanResponderTerminate: settle,
    });
  }, [onSwipe, translateX]);

  return { panHandlers: panResponder.panHandlers, style: { transform: [{ translateX }] } };
}

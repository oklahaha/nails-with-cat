import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** The device's Reduce Motion setting, following changes to it; null until read. */
function useReduceMotionSetting(): boolean | null {
  const [reduced, setReduced] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (live) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

/** Whether the device's Reduce Motion setting is on, following changes to it. */
export function useReduceMotion(): boolean {
  return useReduceMotionSetting() ?? false;
}

/**
 * True only once Reduce Motion has been read as off: for animations that would
 * otherwise start before the setting is known (loading indicators).
 */
export function useMotionAllowed(): boolean {
  return useReduceMotionSetting() === false;
}

import { useEffect, useRef, useState } from 'react';

import { useReduceMotion } from '@/hooks/useReduceMotion';

/** Offsets (pt) a shake steps through, one every SHAKE_STEP_MS. */
export const SHAKE_STEPS = [-8, 8, -6, 6, -3, 0];
export const SHAKE_STEP_MS = 50;

/**
 * A horizontal offset that shakes each time `trigger` goes up (not on mount),
 * for invalid input. Stays 0 with Reduce Motion on, or while not `visible`.
 */
export function useShake(trigger: number, visible: boolean): number {
  const reduceMotion = useReduceMotion();
  const [x, setX] = useState(0);
  // The last trigger seen, so turning Reduce Motion off doesn't replay an old shake
  const shaken = useRef(trigger);
  useEffect(() => {
    if (trigger === shaken.current) return;
    shaken.current = trigger;
    if (reduceMotion || !visible) return;
    const timers = SHAKE_STEPS.map((step, i) => setTimeout(() => setX(step), i * SHAKE_STEP_MS));
    return () => {
      timers.forEach(clearTimeout);
      setX(0);
    };
  }, [trigger, reduceMotion, visible]);
  return x;
}

import { useEffect, useState } from 'react';

/** Milliseconds from `date` to the start of the next minute. */
function untilNextMinute(date: Date): number {
  return 60_000 - (date.getSeconds() * 1000 + date.getMilliseconds());
}

/**
 * The current time, updated at the start of every minute, for screens that
 * stay open across it (the timetable's now line and today's date).
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const next = new Date();
      setNow(next);
      timer = setTimeout(tick, untilNextMinute(next));
    };
    timer = setTimeout(tick, untilNextMinute(new Date()));
    return () => clearTimeout(timer);
  }, []);
  return now;
}

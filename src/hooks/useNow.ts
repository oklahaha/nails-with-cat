import { useEffect, useState } from 'react';

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
      timer = setTimeout(tick, 60_000 - (next.getSeconds() * 1000 + next.getMilliseconds()));
    };
    const first = new Date();
    timer = setTimeout(tick, 60_000 - (first.getSeconds() * 1000 + first.getMilliseconds()));
    return () => clearTimeout(timer);
  }, []);
  return now;
}

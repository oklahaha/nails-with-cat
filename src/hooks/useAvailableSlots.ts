/**
 * 可約時間 for the export screens: from the week shown (or today, if later) to the end of
 * the next week, which the user can move up to the end of the third week, so the
 * poster's calendar keeps at most three rows. `ready` only once this range has just
 * loaded from the sheet (again on returning to the app) and no booking change is still
 * unsent, since the other phone may have filled a time the cache shows free, and an
 * unsent cancellation shows a time free that the sheet doesn't have free yet. Each share
 * also goes through `shareIfCurrent`, which reloads the range first: a push from the other
 * phone refreshes a different range, so nothing else would tell this screen.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { loadAppointments, useAppointments } from '@/hooks/useAppointments';
import { useNow } from '@/hooks/useNow';
import { hasQueuedWrites, useQueuedWrites } from '@/hooks/writeQueue';
import { showAlert } from '@/utils/alert';
import { availableSlots, slotsText } from '@/utils/availableSlots';
import { addDays, parseIsoDate, startOfWeek, studioTime, toIsoDate } from '@/utils/dates';

/** Booking writes that change which times are taken. */
const BOOKING_WRITES = ['saveAppointment', 'deleteAppointment'];

/** `week` when it's a real YYYY-MM-DD date (it comes from the route), else today. */
function validDate(week: string | undefined, today: string): string {
  if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week)) return today;
  return toIsoDate(parseIsoDate(week)) === week ? week : today;
}

export function useAvailableSlots(week: string | undefined) {
  // Today's times drop off as they pass, even with the screen left open; a share check
  // that found one gone mid-minute moves the screen on to its time too
  // In the studio's time zone, wherever the phone is
  const tick = useNow();
  const clock = useMemo(() => studioTime(tick), [tick]);
  const [checkedAt, setCheckedAt] = useState<Date>();
  const now = checkedAt && checkedAt > clock ? checkedAt : clock;
  const today = toIsoDate(now);
  const shown = startOfWeek(validDate(week, today));
  const from = shown > today ? shown : today;
  const latestTo = addDays(startOfWeek(from), 20);
  const [pickedTo, setTo] = useState(() => addDays(startOfWeek(from), 14));
  const to = pickedTo < from ? from : pickedTo > latestTo ? latestTo : pickedTo;

  const { appointments, loading, error, synced, syncError, reload } = useAppointments({
    from,
    to,
  });
  // Back from the background, the other phone may have booked meanwhile
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reload();
    });
    return () => sub.remove();
  }, [reload]);

  const days = useMemo(
    () => (loading || error ? [] : availableSlots(from, to, appointments, now)),
    [loading, error, appointments, from, to, now]
  );
  const unsent = useQueuedWrites(BOOKING_WRITES);

  /**
   * Reload the range, and run `share` only if the times still read `shown` (the text of
   * what's on screen, poster included); otherwise the screen redraws and says to check again.
   */
  const shareIfCurrent = useCallback(
    async (shown: string, share: () => Promise<unknown>) => {
      let fresh: string;
      let at: Date;
      try {
        const rows = await loadAppointments({ from, to });
        // The clock read after the reload, so a time that passed meanwhile is dropped
        at = studioTime(new Date());
        if (hasQueuedWrites(BOOKING_WRITES)) {
          showAlert('預約改動未上傳完', '等改動上傳完先分享，以免列出已約的時間');
          return;
        }
        fresh = slotsText(availableSlots(from, to, rows, at));
      } catch (e) {
        showAlert('未能同步最新預約', e instanceof Error ? e.message : '請再試一次');
        return;
      }
      if (fresh !== shown) {
        setCheckedAt(at);
        showAlert('可約時間有更新', '剛同步到新嘅預約，請睇清楚更新咗嘅時間再分享');
        return;
      }
      await share();
    },
    [from, to]
  );

  // error: nothing cached to show either
  return {
    from,
    to,
    latestTo,
    setTo,
    days,
    loading,
    error,
    ready: synced && !unsent,
    syncError,
    reload,
    shareIfCurrent,
  };
}

import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import {
  listAppointments,
  type ListAppointmentsOptions,
} from '@/services/appointmentsApi';
import type { Appointment } from '@/types/appointment';

/**
 * Load appointments for a date range. Reloads when the range changes and
 * whenever the screen regains focus (e.g. after adding an appointment).
 *
 * `loading` is only true for the very first load; later reloads keep the
 * current data on screen and set `reloading` instead.
 */
export function useAppointments({ from, to }: ListAppointmentsOptions) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasLoadedRef = useRef(false);
  // Ignore responses from older requests when the range changes quickly
  const requestIdRef = useRef(0);

  const load = useCallback(
    async (isRefresh = false) => {
      const requestId = ++requestIdRef.current;
      if (isRefresh) setRefreshing(true);
      else if (hasLoadedRef.current) setReloading(true);
      else setLoading(true);

      try {
        const data = await listAppointments({ from, to });
        if (requestId !== requestIdRef.current) return;
        setAppointments(data);
        setError(null);
        hasLoadedRef.current = true;
      } catch (e) {
        if (requestId !== requestIdRef.current) return;
        setError(e instanceof Error ? e.message : '載入失敗');
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setReloading(false);
          setRefreshing(false);
        }
      }
    },
    [from, to]
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return { appointments, loading, reloading, refreshing, error, reload: load };
}

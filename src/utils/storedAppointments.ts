/**
 * How useAppointments saves its cached ranges on the device. Ranges overlap
 * (the 統計 year holds most of the others), so each booking is saved once
 * and each range keeps only its ids. That keeps the synchronous read at
 * launch small.
 */
import type { Appointment } from '@/types/appointment';

type Stored = { appointments: Appointment[]; ranges: [string, string[]][] };

/** `entries` newest first, so a booking cached in two versions keeps the newest. */
export function serializeRanges(entries: [string, Appointment[]][]): string {
  const byId = new Map<string, Appointment>();
  const ranges = entries.map(([key, list]): [string, string[]] => [
    key,
    list.map((apt) => {
      if (!byId.has(apt.id)) byId.set(apt.id, apt);
      return apt.id;
    }),
  ]);
  return JSON.stringify({ appointments: [...byId.values()], ranges } satisfies Stored);
}

/** The ranges saved by serializeRanges; none if `json` is missing or unreadable. */
export function parseRanges(json: string | null): [string, Appointment[]][] {
  try {
    const parsed = JSON.parse(json ?? 'null') as Stored | null;
    if (!parsed || !Array.isArray(parsed.ranges)) return [];
    const byId = new Map(parsed.appointments.map((apt) => [apt.id, apt]));
    return parsed.ranges.map(([key, ids]) => [key, ids.flatMap((id) => byId.get(id) ?? [])]);
  } catch {
    return [];
  }
}

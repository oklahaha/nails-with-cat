import type { Appointment } from '@/types/appointment';

export type AppointmentsByDate = {
  date: string;
  appointments: Appointment[];
};

/**
 * Group appointments by date (YYYY-MM-DD), sorted ascending by date then time.
 */
export function groupAppointmentsByDate(
  appointments: Appointment[]
): AppointmentsByDate[] {
  const map = new Map<string, Appointment[]>();

  for (const apt of appointments) {
    const list = map.get(apt.date) ?? [];
    list.push(apt);
    map.set(apt.date, list);
  }

  const sortedDates = [...map.keys()].sort();

  return sortedDates.map((date) => ({
    date,
    appointments: (map.get(date) ?? []).sort((a, b) =>
      a.time.localeCompare(b.time)
    ),
  }));
}

/**
 * Format YYYY-MM-DD for section headers (e.g. 2026年10月21日 星期二).
 */
export function formatDateHeader(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;

  const date = new Date(y, m - 1, d);
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const weekday = weekdays[date.getDay()];

  return `${y}年${m}月${d}日 星期${weekday}`;
}

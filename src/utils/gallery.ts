/**
 * What the 作品 tab shows: each 完成作品 photo as one item, newest booking
 * first, filtered by service and customer, then laid out as rows of a grid with
 * a header per month.
 */
import type { Appointment } from '@/types/appointment';
import { photosOf } from '@/utils/appointmentPhotos';

/** 整甲 + 眼睫毛 counts as both; other services (粉嫩術) only show under 全部. */
export type GalleryFilter = 'all' | 'nails' | 'lashes';

export const GALLERY_FILTERS: { value: GalleryFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'nails', label: '整甲' },
  { value: 'lashes', label: '眼睫毛' },
];

export type GalleryItem = {
  path: string;
  appointmentId: string;
  service: string;
  date: string;
};

export type GalleryRow =
  | { type: 'month'; key: string; month: string; count: number }
  | { type: 'photos'; key: string; items: GalleryItem[] };

function matchesFilter(service: string, filter: GalleryFilter): boolean {
  if (filter === 'nails') return service.includes('甲');
  if (filter === 'lashes') return service.includes('眼睫毛');
  return true;
}

export function galleryItems(
  appointments: Appointment[],
  filter: GalleryFilter = 'all',
  query = ''
): GalleryItem[] {
  const q = query.trim().toLowerCase();
  return appointments
    .filter(
      (apt) =>
        matchesFilter(apt.service, filter) && (!q || apt.customerName.toLowerCase().includes(q))
    )
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
    .flatMap((apt) =>
      photosOf(apt, 'finished').map((path) => ({
        path,
        appointmentId: apt.id,
        service: apt.service,
        date: apt.date,
      }))
    );
}

/** `items` (already sorted) as a header for each month and rows of `columns` photos. */
export function galleryRows(items: GalleryItem[], columns: number): GalleryRow[] {
  const rows: GalleryRow[] = [];
  let i = 0;
  while (i < items.length) {
    const month = items[i].date.slice(0, 7);
    let end = i;
    while (end < items.length && items[end].date.slice(0, 7) === month) end++;
    rows.push({ type: 'month', key: `month:${month}`, month: items[i].date, count: end - i });
    for (let start = i; start < end; start += columns) {
      const row = items.slice(start, Math.min(start + columns, end));
      rows.push({ type: 'photos', key: row[0].path, items: row });
    }
    i = end;
  }
  return rows;
}

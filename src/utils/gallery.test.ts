import { describe, expect, it } from '@jest/globals';

import { makeAppointment } from '@/test/appointment';
import { galleryItems, galleryRows } from '@/utils/gallery';

const nails = makeAppointment({ id: 'n', date: '2026-10-05', finishedPhotos: ['n1', 'n2'] });
const both = makeAppointment({
  id: 'b',
  service: '整甲 + 眼睫毛',
  customerName: 'Lily',
  date: '2026-11-02',
  finishedPhotos: ['b1'],
});
const lashes = makeAppointment({
  id: 'l',
  service: '眼睫毛',
  date: '2026-11-02',
  time: '18:00',
  finishedPhotos: ['l1'],
});
const other = makeAppointment({ id: 'o', service: '粉嫩術', date: '2026-09-01', finishedPhotos: ['o1'] });
const none = makeAppointment({ id: 'x', date: '2026-12-01' });
const all = [nails, both, lashes, other, none];

const paths = (items: { path: string }[]) => items.map((item) => item.path);

describe('galleryItems', () => {
  it('lists every photo, newest booking first, skipping bookings without any', () => {
    expect(paths(galleryItems(all))).toEqual(['l1', 'b1', 'n1', 'n2', 'o1']);
  });

  it('counts 整甲 + 眼睫毛 under both filters, and other services under neither', () => {
    expect(paths(galleryItems(all, 'nails'))).toEqual(['b1', 'n1', 'n2']);
    expect(paths(galleryItems(all, 'lashes'))).toEqual(['l1', 'b1']);
  });

  it('searches customer names, ignoring case', () => {
    expect(paths(galleryItems(all, 'all', ' lily '))).toEqual(['b1']);
    expect(galleryItems(all, 'all', '沒有此人')).toEqual([]);
  });
});

describe('galleryRows', () => {
  it('starts each month on a new row, under a header with its count', () => {
    const rows = galleryRows(galleryItems([nails, both, lashes]), 2);
    expect(rows.map((row) => (row.type === 'month' ? `${row.month.slice(0, 7)}:${row.count}` : paths(row.items)))).toEqual([
      '2026-11:2',
      ['l1', 'b1'],
      '2026-10:2',
      ['n1', 'n2'],
    ]);
  });

  it('leaves a short last row and has no rows without photos', () => {
    const rows = galleryRows(galleryItems([nails, both, lashes]), 3);
    expect(rows.filter((row) => row.type === 'photos')).toHaveLength(2);
    expect(galleryRows([], 3)).toEqual([]);
  });
});

import { describe, expect, it } from '@jest/globals';

import { makeAppointment } from '@/test/appointment';
import {
  applyPhotoOps,
  livePhotoOps,
  newPhotoPath,
  showsFinishedPhotos,
  showsReferencePhotos,
  withPhotosOf,
  type PhotoOp,
} from '@/utils/appointmentPhotos';
import { NO_SHOW } from '@/types/appointment';

const op = (overrides: Partial<PhotoOp> = {}): PhotoOp => ({
  appointmentId: 'a1',
  kind: 'reference',
  path: 'p2',
  type: 'add',
  pending: true,
  at: 100,
  ...overrides,
});

describe('newPhotoPath', () => {
  it('uses the shape of AppSheet paths and the script checks for', () => {
    const path = newPhotoPath('finished', new Date(2026, 10, 2, 9, 5, 7));
    expect(path).toMatch(/^完成作品_images\/[A-Za-z0-9]{22}\.完成作品\.090507\.jpg$/);
  });
});

describe('showsFinishedPhotos', () => {
  const now = new Date(2026, 10, 2, 14, 30);

  it('starts at the booking time, before the hourly job marks it 已完成', () => {
    expect(showsFinishedPhotos(makeAppointment({ time: '14:00' }), now)).toBe(true);
    expect(showsFinishedPhotos(makeAppointment({ time: '15:00' }), now)).toBe(false);
  });

  it('goes by the date on other days', () => {
    expect(showsFinishedPhotos(makeAppointment({ date: '2026-11-01', time: '23:00' }), now)).toBe(true);
    expect(showsFinishedPhotos(makeAppointment({ date: '2026-11-03', time: '01:00' }), now)).toBe(false);
  });

  it('hides for No show and 特別事項, unless photos are already there', () => {
    expect(showsFinishedPhotos(makeAppointment({ date: '2026-11-01', status: NO_SHOW }), now)).toBe(false);
    expect(showsFinishedPhotos(makeAppointment({ date: '2026-11-01', service: '特別事項', customerName: '' }), now)).toBe(false);
    expect(
      showsFinishedPhotos(makeAppointment({ date: '2026-12-01', status: NO_SHOW, finishedPhotos: ['p'] }), now)
    ).toBe(true);
  });
});

describe('showsReferencePhotos', () => {
  it('is for customer bookings only', () => {
    expect(showsReferencePhotos(makeAppointment())).toBe(true);
    expect(showsReferencePhotos(makeAppointment({ service: '特別事項', customerName: '' }))).toBe(false);
  });
});

describe('applyPhotoOps', () => {
  it('adds and removes, keeping the same object when nothing changes', () => {
    const apt = makeAppointment({ referencePhotos: ['p1'] });
    expect(applyPhotoOps(apt, [op()]).referencePhotos).toEqual(['p1', 'p2']);
    expect(applyPhotoOps(apt, [op({ type: 'remove', path: 'p1' })]).referencePhotos).toBeUndefined();
    expect(applyPhotoOps(apt, [op({ path: 'p1' })])).toBe(apt);
    expect(applyPhotoOps(apt, [op({ appointmentId: 'other' })])).toBe(apt);
    expect(applyPhotoOps(apt, [op({ kind: 'finished' })]).finishedPhotos).toEqual(['p2']);
  });

  it('lets a reload that started after a finished op speak for itself', () => {
    const apt = makeAppointment();
    expect(applyPhotoOps(apt, [op({ pending: false, at: 100 })], 200)).toBe(apt);
    expect(applyPhotoOps(apt, [op({ pending: false, at: 300 })], 200).referencePhotos).toEqual(['p2']);
    expect(applyPhotoOps(apt, [op({ pending: true, at: 100 })], 200).referencePhotos).toEqual(['p2']);
  });
});

describe('withPhotosOf', () => {
  it('keeps the current photos over a snapshot of the booking', () => {
    const current = makeAppointment({ referencePhotos: ['new'] });
    const snapshot = makeAppointment({ notes: '改了', finishedPhotos: ['removed'] });
    const saved = withPhotosOf(current, snapshot);
    expect(saved.notes).toBe('改了');
    expect(saved.referencePhotos).toEqual(['new']);
    expect('finishedPhotos' in saved).toBe(false);
  });
});

describe('livePhotoOps', () => {
  it('forgets finished ops after a while, never pending ones', () => {
    const ops = [op({ pending: false, at: 0 }), op({ pending: true, at: 0 })];
    expect(livePhotoOps(ops, 10 * 60 * 1000)).toEqual([ops[1]]);
    expect(livePhotoOps(ops, 1000)).toBe(ops);
  });
});

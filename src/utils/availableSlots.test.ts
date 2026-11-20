import { describe, expect, it } from '@jest/globals';

import { makeAppointment } from '@/test/appointment';

import { availableSlots, daySlots, slotsText } from './availableSlots';

const times = (d: ReturnType<typeof daySlots>) =>
  d.slots.map((s) => s.time + (s.lashesOnly ? '*' : ''));

describe('daySlots', () => {
  it('fills an empty day 10:00, 12:45, then waits for the break', () => {
    const day = daySlots('2026-11-24', []);
    expect(day.status).toBe('open');
    expect(times(day)).toEqual(['10:00', '12:45', '16:15']);
  });

  it('closes on Wednesdays', () => {
    expect(daySlots('2026-11-25', []).status).toBe('closed');
  });

  it('lists lashes only once 整甲 would pass 8 hours (the template’s 23/11)', () => {
    const apt = makeAppointment({ date: '2026-11-23', time: '11:30', endTime: '15:00' });
    const day = daySlots('2026-11-23', [apt]);
    expect(day.booked).toEqual(['11:30']);
    expect(times(day)).toEqual(['15:15', '18:45*']);
  });

  it('is full at 4 項目 or over 6 hours of customers', () => {
    const date = '2026-11-23';
    const both = (time: string, endTime: string) =>
      makeAppointment({ date, time, endTime, service: '整甲 + 眼睫毛' });
    expect(daySlots(date, [both('10:00', '14:00'), both('15:00', '19:00')]).status).toBe('full');
    const long = makeAppointment({ date, time: '10:00', endTime: '16:15', service: '補甲' });
    expect(daySlots(date, [long]).status).toBe('full');
    // Exactly 6 hours still leaves a lash booking, reaching 8
    const six = makeAppointment({ ...long, endTime: '16:00' });
    expect(times(daySlots(date, [six]))).toEqual(['16:15*', '20:00*']);
  });

  it('joins overlapping bookings before looking for the break', () => {
    const date = '2026-11-23';
    const rows = [
      makeAppointment({ date, time: '10:00', endTime: '14:00', service: '補甲' }),
      makeAppointment({ date, time: '11:00', endTime: '12:00', service: '補甲' }),
    ];
    expect(times(daySlots(date, rows))[0]).not.toBe('14:15');
  });

  it('counts a booking past midnight in full for the 8 hours', () => {
    const date = '2026-11-23';
    const rows = [
      makeAppointment({ date, time: '10:00', endTime: '13:00', service: '補甲' }),
      makeAppointment({ date, time: '21:00', endTime: '01:00', service: '補甲' }),
    ];
    expect(daySlots(date, rows).status).toBe('full');
  });

  it('needs the break free of 特別事項', () => {
    const date = '2026-11-23';
    const rows = [
      makeAppointment({ date, time: '10:00', endTime: '12:00' }),
      makeAppointment({ date, time: '13:30', endTime: '15:30' }),
      makeAppointment({ date, time: '12:15', endTime: '13:15', service: '特別事項', customerName: '' }),
    ];
    expect(times(daySlots(date, rows))[0]).not.toBe('15:45');
  });

  it('offers the latest start when the limits stop the list early', () => {
    const date = '2026-11-23';
    const apt = makeAppointment({ date, time: '10:00', endTime: '14:00', service: '整甲 + 眼睫毛' });
    expect(times(daySlots(date, [apt]))).toEqual(['14:15', '19:30']);
  });

  it('blocks 特別事項, two hours without an end, and closes a day it covers', () => {
    const date = '2026-11-23';
    const doctor = makeAppointment({ date, time: '10:00', service: '特別事項', customerName: '' });
    expect(times(daySlots(date, [doctor]))[0]).toBe('12:15');
    const away = makeAppointment({ ...doctor, endTime: '22:00' });
    expect(daySlots(date, [away]).status).toBe('closed');
  });

  it('marks a 2 h window lashes only and ignores No show', () => {
    const date = '2026-11-23';
    const evening = makeAppointment({ date, time: '12:15', endTime: '22:00', service: '特別事項', customerName: '' });
    expect(times(daySlots(date, [evening]))).toEqual(['10:00*']);
    const gone = makeAppointment({ date, time: '10:00', endTime: '22:00', status: 'No show' });
    expect(times(daySlots(date, [gone]))).toEqual(['10:00', '12:45', '16:15']);
  });

  it('drops times already past today, to the second', () => {
    const [today] = availableSlots('2026-11-24', '2026-11-24', [], new Date(2026, 10, 24, 11, 0));
    expect(times(today)).toEqual(['11:00', '13:45', '17:15']);
    const [later] = availableSlots('2026-11-24', '2026-11-24', [], new Date(2026, 10, 24, 11, 0, 45));
    expect(times(later)[0]).toBe('11:15');
  });

  it('still looks for times after 3 bookings that leave room', () => {
    const date = '2026-11-23';
    const topUp = (time: string, endTime: string) =>
      makeAppointment({ date, time, endTime, service: '補甲' });
    const day = daySlots(date, [topUp('10:00', '11:00'), topUp('11:15', '12:15'), topUp('13:15', '14:15')]);
    expect(day.status).toBe('open');
    expect(times(day)[0]).toBe('14:30');
    expect(day.booked.length + day.slots.length).toBeLessThanOrEqual(3);
  });
});

describe('slotsText', () => {
  it('strikes booked times and labels each day', () => {
    const apt = makeAppointment({ date: '2026-11-23', time: '11:30', endTime: '15:00' });
    const text = slotsText(availableSlots('2026-11-23', '2026-11-25', [apt], new Date(2026, 10, 1)));
    expect(text).toContain('23/11（一） ~11:30~・15:15・18:45（只限眼睫毛）');
    expect(text).toContain('24/11（二） 10:00・12:45・16:15');
    expect(text).toContain('25/11（三） 休息');
    expect(text.split('\n')[0]).toContain('23/11 至 25/11');
  });
});

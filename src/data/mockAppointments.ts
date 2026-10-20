/**
 * Mock appointment data for UI development.
 *
 * Replace usages of MOCK_APPOINTMENTS with appointmentsApi.listAppointments()
 * once the Google Apps Script web app URL is ready.
 */

import type { Appointment } from '@/types/appointment';

export const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: 'APT-001',
    service: '整甲',
    notes: '喜歡粉色系',
    customerName: '陳小美',
    phone: '85291234567',
    date: '2026-10-21',
    time: '10:00',
    durationMinutes: 90,
    handOrFoot: '手',
    price: 280,
    status: '已預約',
    endTime: '11:30',
  },
  {
    id: 'APT-002',
    service: '眼睫毛',
    notes: '',
    customerName: '王雅婷',
    phone: '85298765432',
    date: '2026-10-21',
    time: '14:00',
    durationMinutes: 60,
    price: 350,
    status: '已預約',
    endTime: '15:00',
  },
  {
    id: 'APT-003',
    service: '整甲 + 眼睫毛',
    notes: '第一次來訪，需要多一點時間溝通',
    customerName: '林詩涵',
    // No phone — WhatsApp button should be hidden
    date: '2026-10-22',
    time: '11:00',
    durationMinutes: 150,
    handOrFoot: '手+腳',
    price: 580,
    status: '已預約',
    endTime: '13:30',
  },
  {
    id: 'APT-004',
    service: '整甲',
    notes: '修甲 + 單色',
    customerName: '張美玲',
    phone: '85261234567',
    date: '2026-10-22',
    time: '15:30',
    durationMinutes: 60,
    handOrFoot: '腳',
    price: 220,
    status: '已預約',
    endTime: '16:30',
  },
  {
    id: 'APT-005',
    service: '眼睫毛',
    notes: '自然款',
    customerName: '黃心怡',
    phone: '85255551234',
    date: '2026-10-23',
    time: '13:00',
    durationMinutes: 75,
    price: 380,
    status: '已預約',
    endTime: '14:15',
  },
];

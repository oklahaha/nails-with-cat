/**
 * Domain types aligned with the Google Sheet columns.
 *
 * Sheet "預約資料" columns:
 *   預約ID, 活動, 備注, 顧客姓名, 日期, 時間, Duration, 手/腳, 收費, 狀態, End Time
 *
 * Sheet "顧客" columns:
 *   顧客ID, 顧客姓名, 電話
 *
 * When you wire up Google Apps Script, map API JSON fields to these types
 * (or rename these fields to match your API response 1:1).
 */

import type { HandOrFoot, ServiceType } from '@/constants/services';

export type { ServiceType };

/** Appointment status values used in the sheet (狀態); 特別事項 rows are often blank. */
export type AppointmentStatus = '預約' | '已完成' | '' | string;

/**
 * One row from 預約資料, enriched with optional phone from 顧客.
 * Phone is joined client-side (or by Apps Script) so WhatsApp can open.
 */
export type Appointment = {
  /** 預約ID — unique key from the sheet */
  id: string;
  /** 活動 — nail / lash service */
  service: ServiceType | string;
  /** 備注 */
  notes: string;
  /** 顧客姓名 */
  customerName: string;
  /** 電話 — from 顧客 sheet; omit or empty if unknown */
  phone?: string;
  /** 日期 — ISO date string YYYY-MM-DD */
  date: string;
  /** 時間 — HH:mm (24h) */
  time: string;
  /** Duration — minutes (optional for mock UI) */
  durationMinutes?: number;
  /** 手/腳 */
  handOrFoot?: string;
  /** 收費 */
  price?: number;
  /** 狀態 */
  status: AppointmentStatus;
  /** End Time — HH:mm */
  endTime?: string;
};

/** Payload for creating a new appointment (Add screen → API). */
export type NewAppointmentInput = {
  customerName: string;
  date: string;
  time: string;
  service: ServiceType;
  notes: string;
  /** Duration in minutes; the script derives End Time from it. */
  durationMinutes?: number;
  /** 手/腳 */
  handOrFoot?: HandOrFoot;
  /** 收費 */
  price?: number;
};

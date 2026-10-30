/**
 * Domain types aligned with the Google Sheet columns.
 *
 * Sheet "預約資料" columns:
 *   預約ID, 活動, 備注, 顧客姓名, 日期, 時間, Duration, 手/腳, 收費, 狀態, End Time, View, 訂金,
 *   複雜款, 拆甲, 延長, 訂金處理
 *   (View holds the customer's name, or 備注 for 特別事項 rows; the script fills it in)
 *   (訂金 is used by every service but 特別事項)
 *   (複雜款 is 不是複雜款 / 半個鐘 / 一個鐘, and 拆甲 and 延長 are TRUE / FALSE; only 整甲 and
 *   整甲 + 眼睫毛 use them)
 *   (訂金處理 holds 保留 when the customer keeps the deposit for the next booking)
 *
 * Sheet "顧客" columns:
 *   顧客ID, 顧客姓名, 電話
 *
 * When you wire up Google Apps Script, map API JSON fields to these types
 * (or rename these fields to match your API response 1:1).
 */

import type { ComplexDesign, HandOrFoot, NailExtras, ServiceType } from '@/constants/services';

export type { ServiceType };

/** Appointment status values used in the sheet (狀態); 特別事項 rows are often blank. */
export type AppointmentStatus = '預約' | '已完成' | 'No show' | '' | string;

/** 狀態 for a customer who didn't come; set from the long-press menus or the forms. */
export const NO_SHOW = 'No show';

/** 狀態 choices when editing (特別事項 rows may also be blank). */
export const STATUS_OPTIONS = ['預約', '已完成', NO_SHOW] as const;

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
  /** 訂金 — TRUE / FALSE in the sheet (whether a deposit was paid) */
  deposit?: boolean;
  /** 複雜款 — 不是複雜款 / 半個鐘 / 一個鐘 */
  complexDesign?: string;
  /** 拆甲 / 延長 — TRUE / FALSE in the sheet */
  removal?: boolean;
  extension?: boolean;
  /** 狀態 */
  status: AppointmentStatus;
  /** End Time — HH:mm */
  endTime?: string;
  /** 訂金處理 is 保留: the customer keeps this deposit for their next booking */
  keepDeposit?: boolean;
};

/** Payload for creating a new appointment (Add screen → API). */
export type NewAppointmentInput = Partial<NailExtras> & {
  /** Blank for 特別事項 */
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
  /** 訂金 — written as TRUE / FALSE, only when sent (拆甲 / 延長 too) */
  deposit?: boolean;
  /** 複雜款 — only written when sent */
  complexDesign?: ComplexDesign;
  /** 保留訂金 — writes 保留 to 訂金處理 (or clears it), only when sent */
  keepDeposit?: boolean;
  /** View — 特別事項 sends 備注; when omitted the script writes the customer's name */
  view?: string;
};

/** Payload for editing an appointment (Edit screen → API). */
export type UpdateAppointmentInput = NewAppointmentInput & {
  /** 狀態 — left unchanged in the sheet when omitted */
  status?: AppointmentStatus;
};

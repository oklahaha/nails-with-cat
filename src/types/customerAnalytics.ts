/**
 * Results of the nightly analysis/ job, from the 客人分析 and 預測 tabs of the
 * separate results spreadsheet (see apps-script/Code.gs). Read-only in the app.
 */

/** One 客人分析 row. */
export type CustomerInsight = {
  /** 顧客ID */
  customerId: string;
  /** 顧客姓名 at the time of the run; the 顧客 row's name wins after a rename */
  name: string;
  /** 分群 */
  segment: string;
  /** P(alive): the chance they haven't silently stopped coming; null if unknown */
  pAlive: number | null;
  /** 預計下次到訪 as YYYY-MM-DD; null when not expected within a year */
  expectedNextVisit: string | null;
  /** 流失: unlikely to return within 60 days, with nothing booked */
  churn: boolean;
  /** 60日內回來機率, 0–1; null if unknown */
  pReturn60d: number | null;
  /** 12個月CLV (HK$) */
  clv12m: number;
  /** 上次到訪 as YYYY-MM-DD */
  lastVisit: string;
  /** 到訪次數 */
  visits: number;
  /** 已有預約 at the time of the run */
  hasUpcoming: boolean;
};

/** One 預測 row: a Monday-to-Sunday week. */
export type ForecastWeek = {
  /** 週開始 as YYYY-MM-DD */
  weekStart: string;
  /** 預計預約 */
  bookings: number;
  /** 80% range of 預計預約 */
  bookingsLow: number;
  bookingsHigh: number;
  /** 預計收入 (HK$) */
  revenue: number;
  /** 已知休息日: days off already noted in the sheet */
  daysOff: number;
};

export type CustomerAnalytics = {
  /** 更新時間 in Hong Kong time (YYYY-MM-DD HH:mm); null before the first run */
  updatedAt: string | null;
  customers: CustomerInsight[];
  forecast: ForecastWeek[];
};

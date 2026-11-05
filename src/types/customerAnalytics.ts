/**
 * Results of the nightly analysis/ job, from the 客人分析, 預測 and 分析摘要
 * tabs of the separate results spreadsheet (see apps-script/Code.gs).
 * Read-only in the app.
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

/**
 * One 分析摘要 row: a single number for the 洞察 view (analysis/src/analysis/summary.py).
 * `item` says what it is (gap_median, never_return, new_return,
 * new_return_source, revenue_share, next_service, workload, two_at_once,
 * model_check, finding and more; unknown items are ignored); `group` / `subgroup` which group it's for.
 */
export type AnalyticsSummaryRow = {
  /** 項目 */
  item: string;
  /** 分類, e.g. 整甲, 頭 20%, 2026-10 */
  group: string;
  /** 子分類, e.g. the next service in next_service; '' when unused */
  subgroup: string;
  /** 數值 */
  value: number | null;
  /** 95% interval (下限 / 上限) where there is one */
  low: number | null;
  high: number | null;
  /** 人數: customers or visits behind the number */
  n: number | null;
  /**
   * 說明: for item `finding`, a plain-language sentence the app shows as is
   * (group = its topic, value = its order). Lets new analyses reach the app
   * without an app update. Absent from older script deployments.
   */
  text?: string;
};

export type CustomerAnalytics = {
  /** 更新時間 in Hong Kong time (YYYY-MM-DD HH:mm); null before the first run */
  updatedAt: string | null;
  customers: CustomerInsight[];
  forecast: ForecastWeek[];
  /** 分析摘要; absent from older script deployments and cached results */
  summary?: AnalyticsSummaryRow[];
};

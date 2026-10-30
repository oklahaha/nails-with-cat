"""Write the results to the separate analysis spreadsheet (never the source sheet).

Two tabs, each fully replaced on every run and read by header name, like the
source sheet:

* 客人分析: one row per customer (from scores.customer_scores)
* 預測: the next weeks' forecast (from forecast.final_forecast)

Dates are written as YYYY-MM-DD text and values with RAW input, so what an
Apps Script reader gets doesn't depend on the spreadsheet's locale.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

from analysis.config import Settings
from analysis.scores import CHURN_HORIZON_DAYS
from analysis.sheets import _sheets_service

WRITE_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
CUSTOMERS_TAB = "客人分析"
FORECAST_TAB = "預測"
STUDIO_TZ = ZoneInfo("Asia/Hong_Kong")

# Sheet header → scores column. 顧客ID first, as the app would key on it.
CUSTOMER_COLUMNS = {
    "顧客ID": "customer_id",
    "顧客姓名": "name",
    "分群": "segment",
    "P(alive)": "p_alive",
    "預計下次到訪": "expected_next_visit",
    "流失": "churn_flag",
    f"{CHURN_HORIZON_DAYS}日內回來機率": f"p_return_{CHURN_HORIZON_DAYS}d",
    "12個月CLV": "clv_12m",
    "上次到訪": "last_visit",
    "到訪次數": "visits",
    "已有預約": "has_upcoming_booking",
}

FORECAST_COLUMNS = {
    "週開始": "week_start",
    "週結束": "week",
    "預計預約": "bookings",
    "預約下限(80%)": "bookings_low",
    "預約上限(80%)": "bookings_high",
    "預計收入": "revenue",
    "收入下限(80%)": "revenue_low",
    "收入上限(80%)": "revenue_high",
    "已知休息日": "planned_days_off",
}

RUN_AT_HEADER = "更新時間"


def run_timestamp(now: datetime | None = None) -> str:
    """The run time in the studio's time zone, e.g. 2026-10-30 17:05."""
    return (now or datetime.now(STUDIO_TZ)).astimezone(STUDIO_TZ).strftime("%Y-%m-%d %H:%M")


def cell(value: Any, decimals: int | None = None) -> Any:
    """A value as the Sheets API takes it: dates as YYYY-MM-DD, NaN/NaT as blank."""
    if value is None or (isinstance(value, float) and np.isnan(value)) or value is pd.NaT:
        return ""
    if isinstance(value, pd.Timestamp):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, (bool, np.bool_)):
        return bool(value)
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (float, np.floating)):
        return round(float(value), decimals) if decimals is not None else float(value)
    return value


# Decimals per column: probabilities to 3, money and counts to whole numbers or 1
DECIMALS = {"p_alive": 3, f"p_return_{CHURN_HORIZON_DAYS}d": 3, "clv_12m": 0,
            "bookings": 1, "bookings_low": 1, "bookings_high": 1,
            "revenue": 0, "revenue_low": 0, "revenue_high": 0}


def customer_table(scores: pd.DataFrame, run_at: str) -> list[list[Any]]:
    """Header + one row per customer, highest CLV first, each with the run time."""
    data = scores.reset_index().sort_values("clv_12m", ascending=False)
    rows = [[*CUSTOMER_COLUMNS, RUN_AT_HEADER]]
    for _, r in data.iterrows():
        rows.append([cell(r[col], DECIMALS.get(col)) for col in CUSTOMER_COLUMNS.values()] + [run_at])
    return rows


def forecast_table(forecast: pd.DataFrame, run_at: str) -> list[list[Any]]:
    """Header + one row per forecast week (Monday to Sunday), each with the run time."""
    data = forecast.reset_index()
    data["week_start"] = data["week"] - pd.to_timedelta(6, unit="D")
    rows = [[*FORECAST_COLUMNS, RUN_AT_HEADER]]
    for _, r in data.iterrows():
        rows.append([cell(r[col], DECIMALS.get(col)) for col in FORECAST_COLUMNS.values()] + [run_at])
    return rows


def check_target(settings: Settings) -> str:
    """The results spreadsheet ID, refusing anything that could be the source sheet."""
    target = settings.analysis_spreadsheet_id
    if not target:
        raise RuntimeError("ANALYSIS_SPREADSHEET_ID is not set (see analysis/.env.example)")
    if target == settings.source_spreadsheet_id:
        raise RuntimeError("ANALYSIS_SPREADSHEET_ID is the source sheet; results must go to a separate spreadsheet")
    return target


def write_results(settings: Settings, tables: dict[str, list[list[Any]]]) -> None:
    """Replace each tab's contents with its table, adding missing tabs first.

    The service account is only a Viewer on the source sheet, and
    check_target refuses the source ID, so this can't touch the bookings.
    """
    target = check_target(settings)
    sheets = _sheets_service(settings, WRITE_SCOPES).spreadsheets()
    existing = {s["properties"]["title"] for s in sheets.get(spreadsheetId=target).execute()["sheets"]}
    missing = [tab for tab in tables if tab not in existing]
    if missing:
        sheets.batchUpdate(spreadsheetId=target, body={
            "requests": [{"addSheet": {"properties": {"title": tab}}} for tab in missing]}).execute()
    # Clear first, so a shorter table doesn't leave old rows below it
    sheets.values().batchClear(spreadsheetId=target, body={"ranges": [f"'{tab}'" for tab in tables]}).execute()
    sheets.values().batchUpdate(spreadsheetId=target, body={
        "valueInputOption": "RAW",
        "data": [{"range": f"'{tab}'!A1", "values": rows} for tab, rows in tables.items()],
    }).execute()

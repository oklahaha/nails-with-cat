"""Turn the raw sheet values into typed, linked pandas frames.

Input is what `sheets.py` returns: rows of UNFORMATTED_VALUE cells, header in
row 1. Columns are looked up by header name, like `apps-script/Code.gs`, so
column order in the sheet doesn't matter.

The rules here come from how the real data was written (see CLAUDE.md):

* 顧客姓名 usually holds the customer's 顧客ID as text, sometimes a name
  (deleting a customer rewrites their bookings to the name), and on some old
  rows free text. `link_customers` resolves each row to a 顧客ID.
* 狀態 is 預約 / 已完成 / No show, blank for 特別事項. 已完成 went unset from
  2024 until it was back-filled in October 2026, so a past 預約 still counts as
  a visit that happened, and OBSERVATION_END doesn't rely on 已完成.
* Duration on AppSheet-era rows is the service default (2:30:00 for every
  整甲), not the real length, so `duration_reliable` is only true for rows the
  app wrote.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

import numpy as np
import pandas as pd

# Google Sheets serial dates count days from this day (same as Excel's 1900 system
# after its leap-year bug): serial 1 is 1899-12-31.
SHEETS_EPOCH = datetime(1899, 12, 30)

SPECIAL_SERVICE = "特別事項"
STATUS_BOOKED = "預約"
STATUS_DONE = "已完成"
STATUS_NO_SHOW = "No show"
KEEP_DEPOSIT = "保留"

# The app's new 預約ID values (src/hooks/appointmentWrites.ts: newAppointmentId)
APP_ID_PATTERN = re.compile(r"^[A-Za-z0-9]{22}$")

# Old bookings that name the customer in 備注 instead, e.g. "顧客: 小貓"
NOTES_CUSTOMER_PATTERN = re.compile(r"顧客\s*[:：]\s*(\S.*)")

# Sheet header → our column name. Only these are read; the AppSheet-only
# columns (完成作品, 粉嫩術時間, 實收, ...) are ignored.
APPOINTMENT_COLUMNS = {
    "預約ID": "appointment_id",
    "活動": "service",
    "備注": "notes",
    "顧客姓名": "customer_raw",
    "日期": "date_raw",
    "時間": "time_raw",
    "Duration": "duration_raw",
    "手/腳": "hand_foot",
    "收費": "price_raw",
    "狀態": "status",
    "End Time": "end_time_raw",
    "訂金": "deposit_raw",
    "複雜款": "complex_design",
    "拆甲": "removal_raw",
    "延長": "extension_raw",
    "訂金處理": "deposit_handling",
}
REQUIRED_APPOINTMENT_COLUMNS = ["預約ID", "活動", "顧客姓名", "日期", "時間", "收費", "狀態"]

CUSTOMER_COLUMNS = {
    "顧客ID": "customer_id",
    "顧客姓名": "name",
    "電話": "phone",
    "IG": "instagram",
    "加入日期": "joined_raw",
}
REQUIRED_CUSTOMER_COLUMNS = ["顧客ID", "顧客姓名"]


# ---------------------------------------------------------------------------
# Cell conversions
# ---------------------------------------------------------------------------


def cell_text(value: Any) -> str:
    """A cell as trimmed text, the way Code.gs's cellText_ reads it.

    UNFORMATTED_VALUE gives numbers for cells that look numeric, so a 顧客ID
    typed as 549 arrives as the int 549 (or 549.0) and must become "549".
    """
    if value is None:
        return ""
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, float):
        if np.isnan(value):
            return ""
        if value.is_integer():
            return str(int(value))
    return str(value).strip()


def serial_to_date(value: Any) -> pd.Timestamp:
    """A Sheets serial date (days since 1899-12-30) as a midnight Timestamp.

    A date-time serial keeps only its whole days. Text cells (dates typed as
    plain text) are read as d/m/yyyy, the order Code.gs assumes
    (TEXT_DATE_ORDER = 'DMY'); anything else is NaT.
    """
    if isinstance(value, bool) or value is None or value == "":
        return pd.NaT
    if isinstance(value, (int, float)):
        return pd.Timestamp(SHEETS_EPOCH + timedelta(days=int(np.floor(value))))
    text = str(value).strip()
    match = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})", text)
    if match:
        day, month, year = (int(g) for g in match.groups())
        try:
            return pd.Timestamp(year=year, month=month, day=day)
        except ValueError:
            return pd.NaT
    return pd.NaT


def serial_to_minutes(value: Any, time_of_day: bool) -> float:
    """A time or duration cell as minutes.

    Sheets stores both as a fraction of a day (0.5 = 12:00 or 12 hours). For a
    time of day only the fractional part counts, since a cell holding a full
    date-time is a whole number of days plus the time. Durations keep the
    whole value. Text like "14:30" or "2:30:00" is read as h:mm[:ss]. Rounded
    to the minute, because 1/1440 isn't exact in binary.
    """
    if isinstance(value, bool) or value is None or value == "":
        return np.nan
    if isinstance(value, (int, float)):
        days = value % 1 if time_of_day else value
        return float(round(days * 24 * 60))
    match = re.fullmatch(r"(\d{1,2}):(\d{2})(?::(\d{2}))?", str(value).strip())
    if match:
        hours, minutes = int(match.group(1)), int(match.group(2))
        return float(hours * 60 + minutes)
    return np.nan


def cell_number(value: Any) -> float:
    """A numeric cell (收費) as float; blank or text that isn't a number is NaN."""
    if isinstance(value, bool) or value is None:
        return np.nan
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace(",", "").lstrip("$")
    try:
        return float(text) if text else np.nan
    except ValueError:
        return np.nan


def cell_flag(value: Any) -> bool | None:
    """A TRUE / FALSE column (checkbox → bool, or the text TRUE / FALSE); blank → None."""
    if isinstance(value, bool):
        return value
    text = cell_text(value).upper()
    if text == "TRUE":
        return True
    if text == "FALSE":
        return False
    return None


# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------


def rows_to_frame(rows: list[list[Any]], columns: dict[str, str], required: list[str]) -> pd.DataFrame:
    """Rows (header first) as a DataFrame of the wanted columns, found by header name.

    The API drops trailing empty cells, so rows can be shorter than the
    header; they're padded with None. Missing optional columns become all-None
    so later code can rely on them existing.
    """
    if not rows:
        raise ValueError("The tab is empty (no header row)")
    headers = [cell_text(h) for h in rows[0]]
    missing = [name for name in required if name not in headers]
    if missing:
        raise ValueError(f"Columns not found: {', '.join(missing)}")
    width = len(headers)
    body = [list(row[:width]) + [None] * (width - len(row)) for row in rows[1:]]
    # The sheet row number (header is row 1), handy when checking a row by hand
    frame = pd.DataFrame(body, columns=range(width), dtype=object)
    out = pd.DataFrame({"sheet_row": np.arange(2, len(body) + 2)})
    for header, name in columns.items():
        out[name] = frame[headers.index(header)].to_numpy() if header in headers else None
    return out


def clean_customers(rows: list[list[Any]]) -> pd.DataFrame:
    """The 顧客 tab: one row per customer, keyed by 顧客ID (text)."""
    raw = rows_to_frame(rows, CUSTOMER_COLUMNS, REQUIRED_CUSTOMER_COLUMNS)
    customers = pd.DataFrame(
        {
            "sheet_row": raw["sheet_row"],
            "customer_id": raw["customer_id"].map(cell_text),
            "name": raw["name"].map(cell_text),
            "phone": raw["phone"].map(cell_text),
            "instagram": raw["instagram"].map(cell_text),
            "joined_date": raw["joined_raw"].map(serial_to_date),
        }
    )
    # Rows with neither an ID nor a name are blank rows left in the sheet
    return customers[(customers["customer_id"] != "") | (customers["name"] != "")].reset_index(drop=True)


def clean_appointments(rows: list[list[Any]]) -> pd.DataFrame:
    """The 預約資料 tab, typed. Not linked to customers yet (see link_customers)."""
    raw = rows_to_frame(rows, APPOINTMENT_COLUMNS, REQUIRED_APPOINTMENT_COLUMNS)
    df = pd.DataFrame({"sheet_row": raw["sheet_row"]})
    df["appointment_id"] = raw["appointment_id"].map(cell_text)
    for col in ["service", "notes", "customer_raw", "hand_foot", "status", "complex_design"]:
        df[col] = raw[col].map(cell_text)
    df["date"] = pd.to_datetime(raw["date_raw"].map(serial_to_date))
    # Text dates are legal (Code.gs reads them as d/m/yyyy) but worth counting
    df["date_was_text"] = raw["date_raw"].map(lambda v: isinstance(v, str) and v.strip() != "")
    df["start_minute"] = raw["time_raw"].map(lambda v: serial_to_minutes(v, time_of_day=True))
    df["end_minute"] = raw["end_time_raw"].map(lambda v: serial_to_minutes(v, time_of_day=True))
    df["duration_min"] = raw["duration_raw"].map(lambda v: serial_to_minutes(v, time_of_day=False))
    df["price"] = raw["price_raw"].map(cell_number)
    df["price_was_text"] = raw["price_raw"].map(
        lambda v: isinstance(v, str) and v.strip() != "" and np.isnan(cell_number(v))
    )
    for col in ["deposit", "removal", "extension"]:
        df[col] = raw[f"{col}_raw"].map(cell_flag)
    df["keep_deposit"] = raw["deposit_handling"].map(cell_text) == KEEP_DEPOSIT

    df["start"] = df["date"] + pd.to_timedelta(df["start_minute"], unit="min")
    df["year"] = df["date"].dt.year.astype("Int64")
    df["month"] = df["date"].dt.to_period("M")

    # Who wrote the row: the app's IDs are 22 alphanumeric characters, AppSheet's aren't.
    df["id_era"] = np.where(df["appointment_id"].str.match(APP_ID_PATTERN), "app", "appsheet")
    # Only the app writes the full length (with add-ons) into Duration. Older rows
    # hold the service default, so durations from them would be wrong.
    df["duration_reliable"] = (df["id_era"] == "app") & df["duration_min"].notna()

    df["is_special"] = df["service"] == SPECIAL_SERVICE
    df["is_no_show"] = df["status"] == STATUS_NO_SHOW

    # Blank rows (no 預約ID) are skipped, as listAppointments_ does
    return df[df["appointment_id"] != ""].reset_index(drop=True)


# ---------------------------------------------------------------------------
# Linking bookings to customers
# ---------------------------------------------------------------------------

# How a booking's 顧客姓名 was resolved (column `link_method`)
LINK_BY_ID = "id"  # 顧客姓名 is a 顧客ID
LINK_BY_NAME = "name"  # 顧客姓名 is exactly one customer's name
LINK_AMBIGUOUS = "ambiguous_name"  # the name of more than one customer: left unlinked
LINK_UNMATCHED = "unmatched"  # text that is neither (free-text notes, deleted customers)
LINK_BLANK = "blank"  # 顧客姓名 empty


def link_customers(appointments: pd.DataFrame, customers: pd.DataFrame) -> pd.DataFrame:
    """Add `customer_id` (None when unlinked), `link_method` and `notes_customer`.

    Order: the text as a 顧客ID first, then an exact match on 顧客姓名. Names
    shared by several customers stay unlinked rather than guessing.
    `notes_customer` holds the name from a "顧客: <name>" note, which is only
    counted, never linked (those names are ambiguous duplicates).
    """
    ids = set(customers.loc[customers["customer_id"] != "", "customer_id"])
    # A customer without a 顧客ID is keyed by name, as in Code.gs
    named = customers.assign(key=customers["customer_id"].where(customers["customer_id"] != "", customers["name"]))
    names = named[named["name"] != ""].groupby("name")["key"].agg(list)

    def resolve(text: str) -> tuple[str | None, str]:
        if text == "":
            return None, LINK_BLANK
        if text in ids:
            return text, LINK_BY_ID
        matches = names.get(text)
        if matches is None:
            return None, LINK_UNMATCHED
        if len(set(matches)) > 1:
            return None, LINK_AMBIGUOUS
        return matches[0], LINK_BY_NAME

    resolved = appointments["customer_raw"].map(resolve)
    out = appointments.copy()
    out["customer_id"] = resolved.map(lambda r: r[0]).astype(object)
    out["link_method"] = resolved.map(lambda r: r[1])
    out["notes_customer"] = out["notes"].map(
        lambda text: m.group(1).strip() if (m := NOTES_CUSTOMER_PATTERN.search(text)) else None
    )
    return out


# ---------------------------------------------------------------------------
# Splitting into the frames the analysis uses
# ---------------------------------------------------------------------------


def default_observation_end(appointments: pd.DataFrame, today: date | None = None) -> pd.Timestamp:
    """The latest customer booking date before `today`: the last day that has surely happened.

    Not the latest 已完成 date, which depends on 已完成 being kept up. Today's own
    bookings are left out, since some of them may not have happened yet.
    """
    cutoff = pd.Timestamp(today or date.today())
    rows = appointments[~appointments["is_special"] & (appointments["date"] < cutoff)]
    if rows.empty:
        raise ValueError("No bookings before today to take OBSERVATION_END from; pass it explicitly")
    return rows["date"].max()


@dataclass
class Frames:
    """The cleaned data, split by what each part may be used for."""

    observation_end: pd.Timestamp
    # Every booking row, linked, with a `role` column saying which frame it went to
    appointments: pd.DataFrame
    customers: pd.DataFrame
    # Customer behaviour: linked, not 特別事項, not No show, on or before observation_end
    visits: pd.DataFrame
    # Linked No show rows on or before observation_end (recorded only recently)
    no_shows: pd.DataFrame
    # 預約 after observation_end: not history, but the customer hasn't churned
    upcoming: pd.DataFrame


# Values of Frames.appointments["role"], checked in this order
ROLE_SPECIAL = "special"
ROLE_NO_DATE = "no_date"
ROLE_UNLINKED = "unlinked"
ROLE_UPCOMING = "upcoming"
ROLE_AFTER_END = "after_observation_end"
ROLE_NO_SHOW = "no_show"
ROLE_VISIT = "visit"


def build_frames(
    appointments: pd.DataFrame,
    customers: pd.DataFrame,
    observation_end: date | pd.Timestamp | None = None,
    today: date | None = None,
) -> Frames:
    """Link bookings to customers and split them into visits / No show / upcoming.

    `appointments` and `customers` come from clean_appointments / clean_customers.
    `today` (default: the real date) only matters when `observation_end` is None.
    """
    linked = link_customers(appointments, customers)
    end = pd.Timestamp(observation_end) if observation_end is not None else default_observation_end(linked, today)
    after_end = linked["date"] > end

    conditions = [
        linked["is_special"],
        linked["date"].isna(),
        linked["customer_id"].isna(),
        after_end & (linked["status"] == STATUS_BOOKED),
        # Anything else dated later (已完成 / No show after the end) is
        # outside the observation window and must not leak into history
        after_end,
        linked["is_no_show"],
    ]
    roles = [ROLE_SPECIAL, ROLE_NO_DATE, ROLE_UNLINKED, ROLE_UPCOMING, ROLE_AFTER_END, ROLE_NO_SHOW]
    linked["role"] = np.select(conditions, roles, default=ROLE_VISIT)

    upcoming = linked[linked["role"] == ROLE_UPCOMING]
    customers = customers.copy()
    customers["has_upcoming_booking"] = customers["customer_id"].isin(set(upcoming["customer_id"]))

    def part(role: str) -> pd.DataFrame:
        return linked[linked["role"] == role].sort_values(["customer_id", "start"]).reset_index(drop=True)

    return Frames(
        observation_end=end,
        appointments=linked,
        customers=customers,
        visits=part(ROLE_VISIT),
        no_shows=part(ROLE_NO_SHOW),
        upcoming=part(ROLE_UPCOMING),
    )

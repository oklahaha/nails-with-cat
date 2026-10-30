"""Features built from the cleaned visits: service categories, visit days and gaps.

These feed the EDA now and the survival / CLV models later, so they follow
one rule throughout: a feature for a cut-off date only uses rows on or before
that date (`Frames.visits` already stops at OBSERVATION_END).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

# 活動 values the app offers (src/constants/services.ts), in its order
SERVICES = ["整甲", "眼睫毛", "整甲 + 眼睫毛", "補甲", "拆甲", "補眼睫毛", "拆眼睫毛", "粉嫩術", "特別事項"]

NAILS = "nails"
LASHES = "lashes"
BOTH = "both"
OTHER = "other"

SERVICE_CATEGORY = {
    "整甲": NAILS,
    "補甲": NAILS,
    "拆甲": NAILS,
    "眼睫毛": LASHES,
    "補眼睫毛": LASHES,
    "拆眼睫毛": LASHES,
    "整甲 + 眼睫毛": BOTH,
    # A beauty treatment, neither nails nor lashes
    "粉嫩術": OTHER,
}

FULL_SETS = {"整甲", "眼睫毛", "整甲 + 眼睫毛"}
# Top-up → the full sets it tops up (src/utils/topUpPrice.ts prices it from the last one)
TOP_UPS = {"補甲": {"整甲", "整甲 + 眼睫毛"}, "補眼睫毛": {"眼睫毛", "整甲 + 眼睫毛"}}
REMOVALS = {"拆甲", "拆眼睫毛"}

# Default Duration in minutes for 手 (src/constants/services.ts), used where a
# row's own Duration isn't reliable. 整甲's 腳 / 手 + 腳 times and the add-ons
# are in default_duration().
DEFAULT_DURATION = {
    "整甲": 120,
    "眼睫毛": 120,
    "整甲 + 眼睫毛": 240,
    "補甲": 60,
    "拆甲": 60,
    "補眼睫毛": 60,
    "拆眼睫毛": 60,
    "粉嫩術": 90,
}
NAIL_HAND_FOOT_DURATION = {"手": 120, "腳": 60, "手 + 腳": 180}
COMPLEX_DESIGN_MINUTES = {"半個鐘": 30, "一個鐘": 60}


def service_kind(service: str) -> str:
    """full_set / top_up / removal / other, for one 活動 value."""
    if service in FULL_SETS:
        return "full_set"
    if service in TOP_UPS:
        return "top_up"
    if service in REMOVALS:
        return "removal"
    return "other"


def add_service_columns(visits: pd.DataFrame) -> pd.DataFrame:
    """Add `category` (nails / lashes / both / other) and `kind` (full_set / top_up / ...)."""
    out = visits.copy()
    out["category"] = out["service"].map(SERVICE_CATEGORY).fillna(OTHER)
    out["kind"] = out["service"].map(service_kind)
    return out


def default_duration(service: str, hand_foot: str = "", complex_design: str = "",
                     removal: bool | None = None, extension: bool | None = None) -> float:
    """The app's rule for a booking's full length (defaultDurationFor in services.ts).

    腳 bookings don't take the 整甲 add-ons. Unknown services give NaN.
    """
    if service not in DEFAULT_DURATION:
        return np.nan
    if service not in ("整甲", "整甲 + 眼睫毛"):
        return float(DEFAULT_DURATION[service])
    minutes = NAIL_HAND_FOOT_DURATION.get(hand_foot, NAIL_HAND_FOOT_DURATION["手"])
    if service == "整甲 + 眼睫毛":
        minutes += DEFAULT_DURATION["眼睫毛"]
    if hand_foot != "腳":
        minutes += COMPLEX_DESIGN_MINUTES.get(complex_design, 0)
        minutes += 30 if removal else 0
        minutes += 60 if extension else 0
    return float(minutes)


def best_duration(appointments: pd.DataFrame) -> pd.Series:
    """Minutes per booking: the row's Duration where the app wrote it, else the service default."""
    defaults = appointments.apply(
        lambda r: default_duration(r["service"], r["hand_foot"], r["complex_design"], r["removal"], r["extension"]),
        axis=1,
    )
    return appointments["duration_min"].where(appointments["duration_reliable"], defaults)


def visit_days(visits: pd.DataFrame) -> pd.DataFrame:
    """One row per customer per day they came in.

    Two bookings on the same day (e.g. 整甲 then 補眼睫毛) are one visit: the
    customer made one trip. The day's services are joined, its category is
    `both` when it mixed nails and lashes, and its spend is the sum (NaN only
    when every price that day is missing, with `price_missing` counting gaps).
    """
    v = add_service_columns(visits)

    def day_category(categories: pd.Series) -> str:
        cats = set(categories)
        if BOTH in cats or {NAILS, LASHES} <= cats:
            return BOTH
        for cat in (NAILS, LASHES):
            if cat in cats:
                return cat
        return OTHER

    grouped = v.groupby(["customer_id", "date"], sort=True)
    days = grouped.agg(
        services=("service", lambda s: " / ".join(s)),
        bookings=("appointment_id", "size"),
        spend=("price", lambda p: p.sum(min_count=1)),
        price_missing=("price", lambda p: int(p.isna().sum())),
        has_full_set=("kind", lambda k: bool((k == "full_set").any())),
        top_up_only=("kind", lambda k: bool((k == "top_up").all())),
    )
    days["category"] = grouped["category"].agg(day_category)
    return days.reset_index()


def inter_visit_gaps(days: pd.DataFrame, observation_end: pd.Timestamp) -> pd.DataFrame:
    """The survival data: one row per gap after each visit day.

    For each visit, the gap runs to the customer's next visit (`event = 1`),
    or, after their last visit, to `observation_end` with `event = 0`: we
    only know they hadn't come back yet (right-censored). `visit_number` is
    1 for the gap after the first visit. The gap carries the earlier visit's
    category, since what a customer had done drives when they return.
    """
    d = days.sort_values(["customer_id", "date"]).copy()
    d["visit_number"] = d.groupby("customer_id").cumcount() + 1
    d["next_date"] = d.groupby("customer_id")["date"].shift(-1)
    d["event"] = d["next_date"].notna().astype(int)
    d["end_date"] = d["next_date"].fillna(pd.Timestamp(observation_end))
    d["gap_days"] = (d["end_date"] - d["date"]).dt.days
    cols = ["customer_id", "visit_number", "date", "end_date", "gap_days", "event", "category",
            "services", "spend", "has_full_set", "top_up_only"]
    return d[cols].rename(columns={"date": "start_date"}).reset_index(drop=True)


def visits_per_customer(days: pd.DataFrame) -> pd.Series:
    """Number of visit days per linked customer."""
    return days.groupby("customer_id").size().rename("visits")

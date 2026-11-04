"""Data-quality counts for every cleaning rule, as small DataFrames.

The EDA notebook shows these tables and `run.py` prints them, so each rule's
effect on the data is visible rather than silent.
"""

from __future__ import annotations

import pandas as pd

from analysis.clean import (
    LINK_BLANK,
    ROLE_VISIT,
    STATUS_BOOKED,
    STATUS_DONE,
    STATUS_NO_SHOW,
    Frames,
)
from analysis.features import SERVICES


def link_summary(frames: Frames) -> pd.DataFrame:
    """How 顧客姓名 resolved, for customer services (特別事項 has no customer)."""
    rows = frames.appointments[~frames.appointments["is_special"]]
    out = rows["link_method"].value_counts().rename("rows").to_frame()
    out["share"] = (out["rows"] / out["rows"].sum()).round(3)
    # Of the unlinked rows, how many name the customer in 備注 ("顧客: <name>")
    out["with_顧客_note"] = rows.groupby("link_method")["notes_customer"].count()
    return out


def unlinked_examples(frames: Frames, n: int = 30) -> pd.DataFrame:
    """The most common unlinked 顧客姓名 texts, to check by eye."""
    rows = frames.appointments
    unlinked = rows[~rows["is_special"] & rows["customer_id"].isna() & (rows["link_method"] != LINK_BLANK)]
    return (
        unlinked.groupby(["link_method", "customer_raw"]).size().rename("rows")
        .sort_values(ascending=False).head(n).reset_index()
    )


def role_summary(frames: Frames) -> pd.DataFrame:
    """Where every booking row went: visit, No show, upcoming, or excluded and why."""
    return frames.appointments["role"].value_counts().rename("rows").to_frame()


def status_by_year(frames: Frames) -> pd.DataFrame:
    """狀態 values per year (customer services only). Unexpected values show up here."""
    rows = frames.appointments[~frames.appointments["is_special"]]
    return pd.crosstab(rows["year"], rows["status"].replace("", "(blank)"), margins=True)


def past_booked_not_done(frames: Frames) -> pd.DataFrame:
    """Visits still marked 預約 though their date has passed, per year.

    We count them as visits that happened. The studio back-filled 已完成 for
    2024-26 in October 2026, so this should be close to zero; if it grows
    again, marking has lapsed.
    """
    v = frames.visits
    return (
        v.groupby("year")["status"]
        .agg(visits="size", still_預約=lambda s: int((s == STATUS_BOOKED).sum()))
        .assign(share=lambda t: (t["still_預約"] / t["visits"]).round(3))
    )


def missing_prices(frames: Frames) -> pd.DataFrame:
    """Visits with a blank 收費, by service and year. They're left blank, not imputed."""
    v = frames.visits
    table = pd.crosstab(v["service"], v["year"], values=v["price"].isna(), aggfunc="sum").fillna(0).astype(int)
    table["total_missing"] = table.sum(axis=1)
    table["total_visits"] = v.groupby("service").size()
    return table.sort_values("total_missing", ascending=False)


def zero_prices(frames: Frames) -> pd.DataFrame:
    """Visits with 收費 = 0 by service: expected for free top-ups within 5 days."""
    v = frames.visits
    return v[v["price"] == 0].groupby("service").size().rename("zero_price_visits").to_frame()


def duration_by_era(frames: Frames) -> pd.DataFrame:
    """整甲 Duration per era: AppSheet rows sit on the 150-minute default."""
    v = frames.visits[frames.visits["service"] == "整甲"]
    return v.groupby("id_era")["duration_min"].agg(
        rows="size",
        median="median",
        share_150_min=lambda d: round(float((d == 150).mean()), 3),
        distinct_values="nunique",
    )


def no_show_summary(frames: Frames) -> pd.DataFrame:
    """No show rows (all, linked or not) by month: how much data there is."""
    rows = frames.appointments[frames.appointments["status"] == STATUS_NO_SHOW]
    if rows.empty:
        return pd.DataFrame({"no_show_rows": []})
    return rows.groupby("month").size().rename("no_show_rows").to_frame()


def checks(frames: Frames) -> pd.DataFrame:
    """One-line counts for the remaining rules and oddities."""
    a = frames.appointments
    customer_rows = a[~a["is_special"]]
    app_rows = a[a["id_era"] == "app"]
    items = {
        "booking rows": len(a),
        "特別事項 rows (excluded)": int(a["is_special"].sum()),
        "customer rows without a linked customer (excluded)": int(customer_rows["customer_id"].isna().sum()),
        "rows naming the customer in 備注 (顧客: …), left unlinked": int((a["notes_customer"].notna() & a["customer_id"].isna()).sum()),
        "No show rows": int((a["status"] == STATUS_NO_SHOW).sum()),
        "upcoming 預約 rows (after OBSERVATION_END)": len(frames.upcoming),
        # Today's bookings: after OBSERVATION_END, so upcoming, though some may be over by now
        "  of which today": int((frames.upcoming["date"] == pd.Timestamp.today().normalize()).sum()),
        "customers with an upcoming booking": int(frames.customers["has_upcoming_booking"].sum()),
        "visits (customer behaviour rows)": int((a["role"] == ROLE_VISIT).sum()),
        "visits with blank 收費": int(frames.visits["price"].isna().sum()),
        "rows with no date": int(a["date"].isna().sum()),
        "rows with the date stored as text": int(a["date_was_text"].sum()),
        "rows with no start time": int(a["start_minute"].isna().sum()),
        # Late-night and early bookings (00:30, 01:47) are real, confirmed by the studio
        "visits starting before 09:00 (real)": int((frames.visits["start_minute"] < 9 * 60).sum()),
        "rows with 收費 as non-numeric text": int(a["price_was_text"].sum()),
        "rows with a non-whole 收費 (e.g. 199.99)": int((a["price"] % 1 > 0).sum()),
        "duplicate 預約ID rows": int(a["appointment_id"].duplicated(keep=False).sum()),
        "rows with a service not in the app's list": int((~a["service"].isin(SERVICES)).sum()),
        "rows marked 保留 (deposit kept)": int(a["keep_deposit"].sum()),
        "app-era rows (22-char 預約ID)": len(app_rows),
        "first app-era booking date": app_rows["date"].min().date() if len(app_rows) else None,
        "first booking date": a["date"].min().date(),
        "last 已完成 date": a.loc[a["status"] == STATUS_DONE, "date"].max().date(),
        "OBSERVATION_END": frames.observation_end.date(),
        "customers in 顧客": len(frames.customers),
        "customers with at least one visit": frames.visits["customer_id"].nunique(),
        "customers in 顧客 without a 顧客ID": int((frames.customers["customer_id"] == "").sum()),
        "duplicate names in 顧客": int(frames.customers["name"].duplicated(keep=False).sum()),
    }
    return pd.Series(items, name="value").to_frame()


def unknown_services(frames: Frames) -> pd.Series:
    a = frames.appointments
    return a.loc[~a["service"].isin(SERVICES), "service"].value_counts()

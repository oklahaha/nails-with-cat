"""How full is the studio? Booked hours, open days and overlapping bookings (notebooks/04).

The forecast is of *fulfilled* bookings: on a full day, customers are turned
away over WhatsApp and never reach the sheet. Whether that happens often
decides how to read a flat forecast (no growth, or no room). There are no
opening hours in the data, so capacity is described from the bookings
themselves: hours booked per open day, how often two bookings overlap (two
people working at once), and how the busiest days and weeks compare with the
rest. A week near its ceiling again and again would be a sign of censoring.

Durations come from features.best_duration: the row's own Duration on rows
the app wrote, the app's rule elsewhere (AppSheet stored defaults).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from analysis.features import best_duration
from analysis.forecast import BOOKINGS_START, WEEK


def max_overlap(starts: pd.Series, ends: pd.Series) -> int:
    """Most bookings running at the same moment (a sweep over start/end events)."""
    events = sorted([(s, 1) for s in starts] + [(e, -1) for e in ends], key=lambda t: (t[0], t[1]))
    current = peak = 0
    for _, step in events:
        current += step
        peak = max(peak, current)
    return peak


def daily_load(visits: pd.DataFrame, start: pd.Timestamp = BOOKINGS_START,
               end: pd.Timestamp | None = None) -> pd.DataFrame:
    """Per calendar day: bookings, booked hours, most bookings at once, open (≥ 1 booking)."""
    v = visits[visits["date"] >= start].dropna(subset=["start"]).copy()
    v["minutes"] = best_duration(v)
    v["end"] = v["start"] + pd.to_timedelta(v["minutes"].fillna(0), unit="min")
    g = v.groupby("date")
    out = pd.DataFrame({
        "bookings": g.size(),
        "booked_hours": g["minutes"].sum() / 60,
        "max_overlap": g.apply(lambda d: max_overlap(d["start"], d["end"])),
        "first_start": g["start"].min().dt.hour + g["start"].min().dt.minute / 60,
        "last_end": g["end"].max().dt.hour + g["end"].max().dt.minute / 60,
    })
    days = pd.date_range(start, end or v["date"].max())
    out = out.reindex(days).fillna({"bookings": 0, "booked_hours": 0.0, "max_overlap": 0})
    out["open"] = out["bookings"] > 0
    out["weekday"] = out.index.dayofweek
    out["year"] = out.index.year
    return out.rename_axis("date")


def yearly_summary(load: pd.DataFrame, busy_quantile: float = 0.9) -> pd.DataFrame:
    """Per year: open days / week, bookings and hours per open day, share of days with an overlap,
    and the share of open days at or above the all-years `busy_quantile` of booked hours."""
    open_days = load[load["open"]]
    busy = open_days["booked_hours"].quantile(busy_quantile)
    g = open_days.groupby("year")
    return pd.DataFrame({
        "open days / week": load.groupby("year")["open"].mean() * 7,
        "bookings / open day": g["bookings"].mean(),
        "booked hours / open day": g["booked_hours"].mean(),
        "hours, 90th pct day": g["booked_hours"].quantile(0.9),
        "share with 2+ at once": g["max_overlap"].agg(lambda s: (s >= 2).mean()),
        f"share of days ≥ {busy:.1f} h": g["booked_hours"].agg(lambda s: (s >= busy).mean()),
    })


def weekly_load(load: pd.DataFrame) -> pd.DataFrame:
    """Per week (Mon–Sun): open days, bookings, booked hours, and hours per open day."""
    w = load.resample(WEEK).agg({"open": "sum", "bookings": "sum", "booked_hours": "sum"})
    w["hours_per_open_day"] = w["booked_hours"] / w["open"].replace(0, np.nan)
    return w.rename(columns={"open": "open_days"})


def ceiling_check(weekly: pd.DataFrame, top_share: float = 0.1) -> dict:
    """Is there a hard ceiling? Compares the busiest weeks with the rest.

    Under a binding capacity limit, the top weeks bunch up just under one
    value (low spread, a pile-up at the max) instead of trailing off.
    Returns the max, the top weeks' range and how many weeks sit within one
    booking of the max.
    """
    b = weekly.loc[weekly["open_days"] > 0, "bookings"]
    top = b[b >= b.quantile(1 - top_share)]
    return {"weeks": int(len(b)), "max": int(b.max()), "p90": float(b.quantile(0.9)),
            "top_weeks_min": int(top.min()), "weeks_within_1_of_max": int((b >= b.max() - 1).sum()),
            "mean": float(b.mean()), "sd": float(b.std())}

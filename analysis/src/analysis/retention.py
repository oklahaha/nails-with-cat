"""Cohort retention and second-visit rates, from visit days (features.visit_days).

Both handle right-censoring the simple way: a cell or rate is only computed
when every customer in it has had the full window before OBSERVATION_END.
Otherwise recent cohorts would look worse just because they're younger.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

# Customers already coming before the sheet's history starts (2022-07) all show
# up as "new" in its first months: their first visit in the data isn't their
# first visit. Cohorts before this month are flagged as left-truncated.
FIRST_CLEAN_COHORT = pd.Period("2022-10", freq="M")


def first_visits(days: pd.DataFrame) -> pd.DataFrame:
    """Per customer: first and second visit dates and the first-visit cohort month."""
    d = days.sort_values(["customer_id", "date"]).copy()
    d["n"] = d.groupby("customer_id").cumcount()
    out = pd.DataFrame({"first_visit": d[d["n"] == 0].set_index("customer_id")["date"]})
    # NaT for customers who never came back
    out["second_visit"] = d[d["n"] == 1].set_index("customer_id")["date"]
    out["cohort"] = out["first_visit"].dt.to_period("M")
    out["left_truncated"] = out["cohort"] < FIRST_CLEAN_COHORT
    return out


def cohort_retention(days: pd.DataFrame, observation_end: pd.Timestamp, max_periods: int = 24,
                     freq: str = "M") -> pd.DataFrame:
    """Share of each first-visit cohort that visited in period k after their first period.

    Rows are cohorts (first-visit month, or quarter with freq="Q"), columns
    k = 0..max_periods. Period 0 is 100% by definition. A cell is NaN when
    period k isn't over yet at observation_end, so it's never filled with a
    partial period. A customer counts once per period however often they came.
    """
    d = days[["customer_id", "date"]].copy()
    cohorts = d.groupby("customer_id")["date"].min().dt.to_period(freq).rename("cohort")
    d = d.join(cohorts, on="customer_id")
    d["k"] = (d["date"].dt.to_period(freq) - d["cohort"]).map(lambda offset: offset.n)
    active = d[d["k"] <= max_periods].drop_duplicates(["customer_id", "k"])
    counts = active.pivot_table(index="cohort", columns="k", values="customer_id", aggfunc="count", fill_value=0)
    counts = counts.reindex(columns=range(max_periods + 1), fill_value=0)
    sizes = cohorts.value_counts().sort_index()
    table = counts.div(sizes, axis=0)

    # Last complete period: the one before observation_end's, unless it ends that day
    end = pd.Timestamp(observation_end)
    current = end.to_period(freq)
    last_complete = current if end.normalize() == current.end_time.normalize() else current - 1
    for cohort in table.index:
        complete_k = (last_complete - cohort).n
        table.loc[cohort, [k for k in table.columns if k > complete_k]] = np.nan
    table.insert(0, "customers", sizes)
    return table


def second_visit_rates(firsts: pd.DataFrame, observation_end: pd.Timestamp,
                       windows: tuple[int, ...] = (30, 60, 90), by: str | None = None) -> pd.DataFrame:
    """Share of new customers who came back within each window of their first visit.

    Only customers whose first visit is at least `window` days before
    observation_end are counted for that window (`eligible_*`): the rest
    haven't had the chance yet. Left-truncated cohorts are left out.
    Grouped by `by` (e.g. a period column) when given.
    """
    f = firsts[~firsts["left_truncated"]].copy()
    gap = (f["second_visit"] - f["first_visit"]).dt.days
    end = pd.Timestamp(observation_end)
    cols = {}
    for w in windows:
        eligible = f["first_visit"] + pd.to_timedelta(w, unit="D") <= end
        cols[f"eligible_{w}d"] = eligible
        # NaN where not eligible, so mean() skips them
        cols[f"rate_{w}d"] = (gap <= w).astype(float).where(eligible)
    data = pd.DataFrame(cols, index=f.index)
    if by is None:
        data["group"] = "all"
        by_key = "group"
    else:
        data[by] = f[by]
        by_key = by
    agg = {f"eligible_{w}d": "sum" for w in windows} | {f"rate_{w}d": "mean" for w in windows}
    out = data.groupby(by_key).agg(agg)
    return out[[c for w in windows for c in (f"eligible_{w}d", f"rate_{w}d")]]

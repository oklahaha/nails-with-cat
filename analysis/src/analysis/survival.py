"""Survival analysis of the time between visits.

The unit is one gap (features.inter_visit_gaps): it starts at a visit day and
ends at the customer's next visit (event = 1) or is right-censored at the
cut-off date (event = 0). Every covariate of a gap uses only what was known
on its start date, so a model fitted on gaps up to a cut-off never sees the
future.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from lifelines import CoxPHFitter, KaplanMeierFitter
from lifelines.utils import concordance_index

from analysis.features import BOTH, LASHES, NAILS, inter_visit_gaps

# Categories the models use; 'other' (粉嫩術, blank 活動) is too rare to estimate
MODEL_CATEGORIES = [NAILS, LASHES, BOTH]

# The fixed rule the personal one replaces: no visit for 6 weeks = churned
FIXED_RULE_DAYS = 42


def gaps_until(days: pd.DataFrame, cutoff: pd.Timestamp) -> pd.DataFrame:
    """The gaps as they looked on `cutoff`: only visits up to it, open gaps censored there.

    This is how training data for a back-test is built: a gap that in reality
    ended after the cut-off is, as far as the cut-off knows, still open.
    """
    cutoff = pd.Timestamp(cutoff)
    return inter_visit_gaps(days[days["date"] <= cutoff], cutoff)


def add_covariates(gaps: pd.DataFrame, spend_fill: float | None = None) -> pd.DataFrame:
    """The Cox model's covariates for each gap, from the customer's history up to its start.

    * `lashes`, `both`: the start visit's category (reference: nails)
    * `log_visit_number`: log of how many visits the customer had made by then
    * `avg_spend_100`: mean known spend per visit so far, in HK$100 (blank 收費
      skipped; customers with none known get `spend_fill`, default the median here,
      and `spend_unknown` = 1. Pass the training median when scoring test rows.)
    * `top_up_only`: the start visit was only top-ups (補甲 / 補眼睫毛)
    * `q2`..`q4`: quarter of the start date (reference: Q1), for season
    * `log_prev_gap`: log of the customer's mean earlier gap, i.e. their own
      rhythm (0 on a first gap, which `first_gap` marks)
    """
    g = gaps.sort_values(["customer_id", "start_date"]).copy()
    by_customer = g.groupby("customer_id", sort=False)

    g["lashes"] = (g["category"] == LASHES).astype(int)
    g["both"] = (g["category"] == BOTH).astype(int)
    g["log_visit_number"] = np.log(g["visit_number"])

    # Expanding mean of spend up to and including the start visit (known on that day)
    spend_sum = by_customer["spend"].transform(lambda s: s.fillna(0).cumsum())
    spend_n = by_customer["spend"].transform(lambda s: s.notna().cumsum())
    avg_spend = spend_sum / spend_n.replace(0, np.nan)
    g["spend_unknown"] = avg_spend.isna().astype(int)
    fill = avg_spend.median() if spend_fill is None else spend_fill
    g["avg_spend_100"] = avg_spend.fillna(fill) / 100

    g["top_up_only"] = g["top_up_only"].astype(int)
    quarter = g["start_date"].dt.quarter
    for q in (2, 3, 4):
        g[f"q{q}"] = (quarter == q).astype(int)

    # Earlier gaps all ended at a visit on or before this start date, so they're known
    prev_sum = by_customer["gap_days"].transform(lambda s: s.shift().fillna(0).cumsum())
    prev_n = g["visit_number"] - 1
    g["first_gap"] = (prev_n == 0).astype(int)
    g["log_prev_gap"] = np.log((prev_sum / prev_n.replace(0, np.nan)).clip(lower=1)).fillna(0)
    return g.reset_index(drop=True)


COVARIATES = ["lashes", "both", "log_visit_number", "avg_spend_100", "spend_unknown",
              "top_up_only", "q2", "q3", "q4", "log_prev_gap", "first_gap"]


def model_frame(gaps: pd.DataFrame, covariates: list[str] = COVARIATES,
                strata: list[str] | None = None) -> pd.DataFrame:
    """Rows and columns lifelines needs: duration, event, covariates, customer for clustering."""
    rows = gaps[gaps["category"].isin(MODEL_CATEGORIES)]
    cols = ["gap_days", "event", "customer_id", *covariates, *(strata or [])]
    return rows[list(dict.fromkeys(cols))].reset_index(drop=True)


def fit_km(gaps: pd.DataFrame, label: str = "all") -> KaplanMeierFitter:
    return KaplanMeierFitter(label=label).fit(gaps["gap_days"], gaps["event"])


def fit_cox(frame: pd.DataFrame, strata: list[str] | None = None, penalizer: float = 0.01) -> CoxPHFitter:
    """Cox PH with robust (sandwich) standard errors clustered by customer.

    One customer contributes many gaps, which aren't independent; clustering
    keeps the confidence intervals honest. A small ridge penalty keeps the fit
    stable when a covariate is rare.
    """
    cph = CoxPHFitter(penalizer=penalizer)
    cph.fit(frame, duration_col="gap_days", event_col="event", cluster_col="customer_id",
            strata=strata, robust=True)
    return cph


def survival_grid(cph: CoxPHFitter, rows: pd.DataFrame, horizon_days: int = 2500) -> pd.DataFrame:
    """S(t) for each row (columns) at t = 0..horizon (index); past the data S(t) stays at its last value.

    The default covers the longest possible gap (data start to today) plus a horizon.
    """
    times = np.arange(0, horizon_days + 1)
    return cph.predict_survival_function(rows, times=times)


def conditional_return(sf: pd.DataFrame, waited: pd.Series, horizon: int) -> pd.Series:
    """P(next visit within `horizon` more days | no visit for `waited` days so far).

    = 1 − S(waited + horizon) / S(waited): the standard conditional survival.
    `sf` columns line up with `waited`'s positions.
    """
    # Positions, not labels: row t of the grid is day t
    t_max = len(sf) - 1
    out = []
    for i, t0 in enumerate(waited.to_numpy()):
        s0 = sf.iloc[min(int(t0), t_max), i]
        s1 = sf.iloc[min(int(t0) + horizon, t_max), i]
        out.append(1 - s1 / s0 if s0 > 0 else 0.0)
    return pd.Series(out, index=waited.index)


def conditional_median_remaining(sf: pd.DataFrame, waited: pd.Series) -> pd.Series:
    """Days until the conditional survival S(t)/S(waited) first drops to 0.5.

    NaN when it never does within the grid: by the model, the customer is
    more likely than not never to come back.
    """
    out = []
    for i, t0 in enumerate(waited.to_numpy()):
        curve = sf.iloc[:, i].to_numpy()
        t0 = min(int(t0), len(curve) - 1)
        if curve[t0] <= 0:
            out.append(np.nan)
            continue
        below = np.nonzero(curve[t0:] / curve[t0] <= 0.5)[0]
        out.append(float(below[0]) if len(below) else np.nan)
    return pd.Series(out, index=waited.index)


def c_index(frame: pd.DataFrame, predicted_time: pd.Series) -> float:
    """Harrell's concordance: how often the shorter predicted gap is the one that ended first."""
    return concordance_index(frame["gap_days"], predicted_time, frame["event"])


def rhythm_baseline(frame: pd.DataFrame, fallback_days: float) -> pd.Series:
    """Naive prediction: the next gap is as long as the customer's average gap so far.

    First gaps (no history) get `fallback_days`, the training median.
    """
    return pd.Series(np.where(frame["first_gap"] == 1, fallback_days, np.exp(frame["log_prev_gap"])),
                     index=frame.index)


def current_gaps(days: pd.DataFrame, cutoff: pd.Timestamp, spend_fill: float | None = None) -> pd.DataFrame:
    """Each customer's open gap at `cutoff`, with covariates: the rows to score for churn."""
    g = add_covariates(gaps_until(days, cutoff), spend_fill)
    return g[g["event"] == 0].reset_index(drop=True)


def returned_within(days: pd.DataFrame, cutoff: pd.Timestamp, horizon: int) -> pd.Series:
    """Per customer: did they visit in (cutoff, cutoff + horizon]? The back-test's truth."""
    cutoff = pd.Timestamp(cutoff)
    window = days[(days["date"] > cutoff) & (days["date"] <= cutoff + pd.to_timedelta(horizon, unit="D"))]
    return pd.Series(True, index=pd.Index(window["customer_id"].unique(), name="customer_id"))

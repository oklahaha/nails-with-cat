"""Will a customer come back within h days? Landmark logistic models (the churn flag's source).

Why not the Cox model of survival.py? Back-tested at 16 cut-offs, its
P(return within 60 days) hardly moved with a customer's history: ~0.62 for
anyone seen in the last 30 days, whether they had 1 visit (38% actually came
back) or 15+ (92% did). Past ~40 days most customers still out are the ones
who left, so the shared baseline hazard drops, and proportional hazards make
every customer's hazard drop with it, the overdue regular's too. Calibrating
its output can't fix that: customers with the same prediction behave
differently. Cox stays in survival.py to *explain* gaps (hazard ratios).

**Landmark approach** (van Houwelingen 2007): at many past cut-off dates
("landmarks") take every customer's state on that date and whether they
visited within the next h days. Each landmark row's outcome is known h days
later, so a model for scoring on date c is trained only on landmarks up to
c − h: nothing from the future leaks in. A plain logistic regression (one per
horizon) on these rows predicts P(return within h | state today) directly,
and the rhythm features let a regular's chance fall off once they're past
their own usual gap, which Cox couldn't.

* P(return within 60 days): the churn flag (below CHURN_THRESHOLD, no
  upcoming booking) and the 60日內回來機率 column
* expected next visit: the horizon where P(return within h) reaches 0.5,
  interpolated across HORIZONS (blank if not within a year), so the date
  agrees with the probability

The model choice, threshold and back-tests are in notebooks/04.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

from analysis import survival as SV

CHURN_HORIZON_DAYS = 60
# Horizons for the expected next visit (days); 60 must be among them
HORIZONS = [7, 14, 21, 30, 45, 60, 90, 120, 180, 270, 365]
# Landmarks every LANDMARK_STEP_DAYS from LANDMARK_START (2022 is AppSheet ramp-up
# and left-truncated: existing customers looked new)
LANDMARK_START = pd.Timestamp("2023-01-01")
LANDMARK_STEP_DAYS = 14

# P(return within 60 days) below this, and nothing booked = churn flag: "more
# likely not to come back within 60 days than to come back". Picked in
# notebooks/04: the max-F1 threshold on out-of-sample predictions over the
# year before the last was 0.51, and with calibrated probabilities 0.5 is the
# natural reading; checked on the last year against the 6-week rule and Cox.
CHURN_THRESHOLD = 0.5

FEATURES = [
    "log_wait", "log_wait2", "first", "log_vn", "rel", "rel2", "rel_pos", "over_max", "cv",
    "lashes", "both", "spend", "spend_unknown", "top_up_only", "month_sin", "month_cos",
    "relpos_vn", "over_vn", "cv_relpos", "first_wait",
]


def state_at(days: pd.DataFrame, cutoff: pd.Timestamp) -> pd.DataFrame:
    """Each customer's state at `cutoff` (one row per customer with a visit by then).

    Uses only visits on or before the cut-off. Customers whose last visit was
    'other' (粉嫩術 / blank 活動) have no category and are left out, as in the
    Cox model. Features:

    * log_wait (+ squared): days since the last visit
    * first: only one visit so far; log_vn: log of visits so far
    * rel: log(days waited / their mean earlier gap), i.e. how overdue against
      their own rhythm (0 with one visit); rel_pos = max(rel, 0)
    * over_max: log(waited / their longest earlier gap) where positive: past
      anything they've done before
    * cv: CV of their earlier gaps (1 when unknown): how regular they are
    * lashes / both: last visit's category (reference nails); spend: mean known
      spend per visit in HK$100; top_up_only: last visit was only top-ups
    * month_sin / month_cos: time of year of the cut-off
    * interactions: relpos_vn, over_vn, cv_relpos, first_wait
    """
    cutoff = pd.Timestamp(cutoff)
    g = SV.add_covariates(SV.gaps_until(days, cutoff)).sort_values(["customer_id", "start_date"])
    previous = g.groupby("customer_id")["gap_days"].shift()
    by_customer = previous.groupby(g["customer_id"])
    g["max_prev"] = by_customer.cummax()
    g["sd_prev"] = by_customer.expanding().std().reset_index(level=0, drop=True)
    cur = g[(g["event"] == 0) & g["category"].isin(SV.MODEL_CATEGORIES)]

    wait = cur["gap_days"].clip(lower=1).astype(float)
    mean_prev = np.exp(cur["log_prev_gap"])
    first = cur["first_gap"] == 1
    x = pd.DataFrame({
        "customer_id": cur["customer_id"].to_numpy(),
        "cutoff": cutoff,
        "days_since_last_visit": cur["gap_days"].to_numpy(),
        "visits": cur["visit_number"].to_numpy(),
        "last_visit": cur["start_date"].to_numpy(),
        "last_category": cur["category"].to_numpy(),
        "log_wait": np.log(wait).to_numpy(),
        "first": first.astype(int).to_numpy(),
        "log_vn": cur["log_visit_number"].to_numpy(),
        "rel": np.where(first, 0.0, np.log(wait / mean_prev)),
        "over_max": np.where(first, 0.0, np.clip(np.log(wait / cur["max_prev"].clip(lower=1)), 0, None)),
        "cv": (cur["sd_prev"] / mean_prev).fillna(1.0).clip(0, 3).to_numpy(),
        "lashes": cur["lashes"].to_numpy(),
        "both": cur["both"].to_numpy(),
        "spend": cur["avg_spend_100"].to_numpy(),
        "spend_unknown": cur["spend_unknown"].to_numpy(),
        "top_up_only": cur["top_up_only"].to_numpy(),
        "month_sin": np.sin(2 * np.pi * cutoff.month / 12),
        "month_cos": np.cos(2 * np.pi * cutoff.month / 12),
    })
    x["log_wait2"] = x["log_wait"] ** 2
    x["rel2"] = x["rel"] ** 2
    x["rel_pos"] = x["rel"].clip(lower=0)
    x["relpos_vn"] = x["rel_pos"] * x["log_vn"]
    x["over_vn"] = x["over_max"] * x["log_vn"]
    x["cv_relpos"] = x["cv"] * x["rel_pos"]
    x["first_wait"] = x["first"] * x["log_wait"]
    return x


def add_outcomes(states: pd.DataFrame, days: pd.DataFrame, horizons: list[int] = HORIZONS) -> pd.DataFrame:
    """Columns y_<h>: did the customer visit within h days after the row's cut-off?

    Rows whose window isn't over by the last visit date in `days` get NaN.
    """
    out = states.copy()
    last_known = days["date"].max()
    visits = days[["customer_id", "date"]]
    merged = out[["customer_id", "cutoff"]].reset_index().merge(visits, on="customer_id", how="left")
    after = merged[merged["date"] > merged["cutoff"]]
    first_after = after.groupby("index")["date"].min()
    wait = (first_after - out["cutoff"]).dt.days.reindex(out.index)
    for h in horizons:
        known = out["cutoff"] + pd.to_timedelta(h, unit="D") <= last_known
        out[f"y_{h}"] = np.where(known, (wait <= h).astype(float), np.nan)
    return out


def landmark_frame(days: pd.DataFrame, end: pd.Timestamp, horizons: list[int] = HORIZONS,
                   start: pd.Timestamp = LANDMARK_START, step_days: int = LANDMARK_STEP_DAYS) -> pd.DataFrame:
    """States at every landmark from `start` to `end`, with outcomes known by `end`."""
    end = pd.Timestamp(end)
    seen = days[days["date"] <= end]
    cutoffs = pd.date_range(start, end, freq=f"{step_days}D")
    frames = [state_at(seen, c) for c in cutoffs]
    return add_outcomes(pd.concat(frames, ignore_index=True), seen, horizons)


@dataclass
class ReturnModel:
    """One standardised logistic regression per horizon."""

    horizons: list[int]
    models: dict[int, LogisticRegression] = field(default_factory=dict)
    means: pd.Series | None = None
    sds: pd.Series | None = None

    def predict(self, states: pd.DataFrame) -> pd.DataFrame:
        """P(return within h) per row and horizon, made non-decreasing in h."""
        z = (states[FEATURES] - self.means) / self.sds
        p = pd.DataFrame({h: self.models[h].predict_proba(z)[:, 1] for h in self.horizons}, index=states.index)
        return p.cummax(axis=1)


def fit(landmarks: pd.DataFrame, cutoff: pd.Timestamp, horizons: list[int] = HORIZONS, C: float = 1.0) -> ReturnModel:
    """Fit the horizon models for scoring on `cutoff`: landmarks whose h-day outcome is known by then."""
    cutoff = pd.Timestamp(cutoff)
    usable = landmarks[landmarks["cutoff"] <= cutoff]
    means, sds = usable[FEATURES].mean(), usable[FEATURES].std().replace(0, 1)
    model = ReturnModel(horizons, means=means, sds=sds)
    for h in horizons:
        rows = usable[(usable["cutoff"] <= cutoff - pd.to_timedelta(h, unit="D")) & usable[f"y_{h}"].notna()]
        z = (rows[FEATURES] - means) / sds
        model.models[h] = LogisticRegression(C=C, max_iter=3000).fit(z, rows[f"y_{h}"].astype(int))
    return model


def expected_days_to_return(p: pd.DataFrame) -> pd.Series:
    """Days until P(return within h) reaches 0.5, linear between horizons; NaN past the last."""
    horizons = np.asarray(p.columns, dtype=float)
    values = p.to_numpy()
    out = np.full(len(p), np.nan)
    for i, row in enumerate(values):
        above = np.nonzero(row >= 0.5)[0]
        if len(above) == 0:
            continue
        j = above[0]
        if j == 0:
            out[i] = horizons[0] * 0.5 / max(row[0], 1e-9)  # within the first horizon: scale down
            continue
        p0, p1, h0, h1 = row[j - 1], row[j], horizons[j - 1], horizons[j]
        out[i] = h0 + (0.5 - p0) / max(p1 - p0, 1e-9) * (h1 - h0)
    return pd.Series(out, index=p.index)


def return_scores(days: pd.DataFrame, cutoff: pd.Timestamp, landmarks: pd.DataFrame | None = None) -> pd.DataFrame:
    """Per customer at `cutoff`: P(return within 60 days) and expected next visit (scores.py's input)."""
    cutoff = pd.Timestamp(cutoff)
    if landmarks is None:
        landmarks = landmark_frame(days, cutoff)
    model = fit(landmarks, cutoff)
    states = state_at(days, cutoff)
    p = model.predict(states)
    wait = expected_days_to_return(p)
    out = states[["customer_id", "last_visit", "days_since_last_visit", "last_category", "visits"]].copy()
    out[f"p_return_{CHURN_HORIZON_DAYS}d"] = p[CHURN_HORIZON_DAYS].to_numpy()
    out["expected_next_visit"] = cutoff + pd.to_timedelta(wait.to_numpy(), unit="D")
    return out.set_index("customer_id")


def backtest(days: pd.DataFrame, cutoffs: list[pd.Timestamp], horizons: list[int] = HORIZONS,
             landmarks: pd.DataFrame | None = None) -> pd.DataFrame:
    """Out-of-sample predictions at each cut-off, with the real outcomes (for notebooks/04).

    One landmark frame up to the last date with data (pass the one already
    built to save the work); each cut-off's model only uses landmarks whose
    outcomes were known on that cut-off.
    """
    end = days["date"].max()
    if landmarks is None:
        landmarks = landmark_frame(days, end, horizons)
    rows = []
    for c in cutoffs:
        c = pd.Timestamp(c)
        model = fit(landmarks, c, horizons)
        states = add_outcomes(state_at(days[days["date"] <= end], c), days, horizons)
        p = model.predict(states)
        states = states.assign(**{f"p_{h}": p[h].to_numpy() for h in horizons},
                               expected_days=expected_days_to_return(p).to_numpy())
        rows.append(states)
    return pd.concat(rows, ignore_index=True)
